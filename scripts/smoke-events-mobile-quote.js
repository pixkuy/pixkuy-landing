const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const MOBILE_SOURCE_PATH = path.join(
  ROOT,
  "assets/js/services/events-mobile-config-step.js"
);
const QUOTE_SOURCE_PATH = path.join(
  ROOT,
  "assets/js/services/events-special-quote.js"
);
const DESKTOP_SOURCE_PATH = path.join(
  ROOT,
  "assets/js/forms/contact-event-special-editor.js"
);
const TEST_HOOK_ANCHOR = "  window.PixkuyEventsMobileConfigStep = {";

function createRuntime() {
  const posts = [];
  const quoteSource = fs.readFileSync(QUOTE_SOURCE_PATH, "utf8");
  const mobileSource = fs.readFileSync(MOBILE_SOURCE_PATH, "utf8");
  const anchorMatches = mobileSource.split(TEST_HOOK_ANCHOR).length - 1;

  assert.equal(anchorMatches, 1, "mobile test hook anchor must be unique");

  const instrumentedMobileSource = mobileSource.replace(
    TEST_HOOK_ANCHOR,
    [
      "  window.__pixkuyEventsMobileQuoteTest = {",
      "    setContext: function setContext(payload, nextState, nextStep) {",
      "      currentPayload = payload;",
      "      state = nextState;",
      "      stepNode = nextStep || null;",
      "      resetQuoteState();",
      "    },",
      "    setVariant: function setVariant(variant) { state.selectedVariant = variant; },",
      "    getQuoteInput: getQuoteInput,",
      "    getEventTitle: getEventTitle,",
      "    getReturnPickupDayOffset: getReturnPickupDayOffset,",
      "    requestQuoteIfReady: requestQuoteIfReady,",
      "    getQuoteState: function getQuoteState() {",
      "      return { state: currentQuoteState, result: currentQuoteResult };",
      "    }",
      "  };",
      "",
      TEST_HOOK_ANCHOR
    ].join("\n")
  );
  const window = {
    addEventListener: function addEventListener() {},
    matchMedia: function matchMedia() {
      return { matches: true };
    },
    PIXKUY_BOOKING_API_CONFIG: {
      apiBaseUrl: "",
      publicSiteKey: "local-test"
    },
    PixkuyBookingPublicConfig: {
      ready: Promise.resolve()
    },
    fetch: async function fetch(url, options) {
      const payload = JSON.parse(options.body);

      posts.push({ url, method: options.method, payload });

      return {
        ok: true,
        status: 200,
        json: async function json() {
          return {
            ok: true,
            snapshotVersion: payload.snapshotVersion,
            quote: {
              price: 550,
              currency: "MXN",
              outboundDurationSeconds: 1200,
              returnDurationSeconds: 1200
            }
          };
        }
      };
    }
  };
  const document = {
    querySelector: function querySelector() {
      return null;
    },
    body: {
      setAttribute: function setAttribute() {}
    }
  };
  const context = {
    AbortController,
    Intl,
    Map,
    Promise,
    console,
    document,
    setTimeout,
    window
  };

  vm.runInNewContext(quoteSource, context, { filename: QUOTE_SOURCE_PATH });
  vm.runInNewContext(instrumentedMobileSource, context, {
    filename: MOBILE_SOURCE_PATH
  });

  return {
    hooks: window.__pixkuyEventsMobileQuoteTest,
    posts,
    quoteModule: window.PixkuyServicesEventsSpecialQuote
  };
}

function createPayload() {
  return {
    venueId: "auditorio_nacional",
    group: {
      id: "festival_2027",
      venueId: "auditorio_nacional",
      events: [
        {
          id: "festival_2027",
          startsAt: "2027-01-01T20:00",
          venueId: "auditorio_nacional",
          snapshotVersion: 7
        }
      ]
    }
  };
}

function createState(variant) {
  return {
    selectedEventId: "festival_2027",
    selectedVariant: variant,
    selectedPassengerFareKey: "van_3_4",
    originAddress: "Origen seleccionado",
    originAddressPlace: {
      label: "Origen seleccionado",
      placeId: "origin-place",
      lat: 19.428,
      lng: -99.163
    },
    destinationAddress: "Destino seleccionado",
    destinationAddressPlace: {
      label: "Destino seleccionado",
      placeId: "destination-place",
      lat: 19.432,
      lng: -99.133
    },
    originPickupTime: "16:28",
    returnPickupTime: "01:28",
    returnPickupDayOffset: 1
  };
}

function createStep() {
  const cta = {
    attributes: {},
    disabled: true,
    setAttribute: function setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };

  return {
    cta,
    node: {
      querySelector: function querySelector(selector) {
        return selector === "[data-events-mobile-config-cta]" ? cta : null;
      },
      querySelectorAll: function querySelectorAll() {
        return [];
      }
    }
  };
}

async function flushQuote() {
  await new Promise(function wait(resolve) {
    setImmediate(resolve);
  });
}

async function assertCompleteVariant(variant) {
  const runtime = createRuntime();
  assert.equal(runtime.hooks.getEventTitle({id:'synthetic_event',title:'Evento publicado con nombre largo'}),'Evento publicado con nombre largo','mobile configuration keeps the catalog display name');
  assert.equal(runtime.hooks.getEventTitle({id:'legacy_event'}),'legacy_event','legacy fallback remains available');
  const state = createState(variant);
  const step = createStep();

  runtime.hooks.setContext(createPayload(), state, step.node);

  const input = runtime.hooks.getQuoteInput();
  const payload = runtime.quoteModule.buildQuotePayload(input);

  assert.equal(payload.eventId, "festival_2027");
  assert.equal(payload.venueId, "auditorio_nacional");
  assert.equal(input.snapshotVersion, 7);
  assert.equal(payload.snapshotVersion, 7);
  assert.equal(payload.variant, variant);
  assert.equal(payload.passengerFareKey, "van_3_4");
  assert.equal(runtime.quoteModule.isQuotePayloadComplete(payload), true);

  if (variant === "arrival" || variant === "round_trip") {
    assert.equal(payload.originAddress.label, "Origen seleccionado");
    assert.equal(payload.originAddress.placeId, "origin-place");
    assert.equal(payload.originAddress.lat, 19.428);
    assert.equal(payload.originAddress.lng, -99.163);
    assert.equal(payload.originPickupTime, "16:28");
  } else {
    assert.equal(payload.originAddress, undefined);
  }

  if (variant === "departure" || variant === "round_trip") {
    assert.equal(payload.destinationAddress.label, "Destino seleccionado");
    assert.equal(payload.destinationAddress.placeId, "destination-place");
    assert.equal(payload.destinationAddress.lat, 19.432);
    assert.equal(payload.destinationAddress.lng, -99.133);
    assert.equal(payload.returnPickupTime, "01:28");
    assert.equal(payload.returnPickupDayOffset, 1);
  } else {
    assert.equal(payload.destinationAddress, undefined);
  }

  assert.equal(runtime.hooks.requestQuoteIfReady(), true);
  await flushQuote();

  assert.equal(runtime.posts.length, 1);
  assert.equal(runtime.posts[0].method, "POST");
  assert.equal(runtime.posts[0].url, "/v1/public/special-events/quote");
  assert.equal(runtime.hooks.getQuoteState().state, "ready");
  assert.equal(step.cta.disabled, false);
  assert.equal(step.cta.attributes["aria-disabled"], "false");
}

function packageRuntime(settings={}) {
  const storage=settings.storage||new Map();const calls=[];const quotes=[];let serial=0;
  const receipt=settings.receipt||{requestKind:'custom',reference:'EVT-'+('1'.repeat(32)),eventTitle:'Evento sintético',packageTitle:null,optionTitle:null,passengerBand:null,serviceCount:null,pricedSubtotal:null,currency:'MXN',priceStatus:'personalized',pendingCodes:['CUSTOM_ASSESSMENT']};
  const window={setTimeout,clearTimeout,crypto:settings.noCrypto?undefined:{getRandomValues(bytes){bytes.fill(++serial);return bytes}},document:{querySelector(){return {href:'https://wa.me/520000000000'}}},sessionStorage:{getItem(key){if(settings.storageBlocked)throw Error('blocked');return storage.get(key)||null},setItem(key,value){if(settings.storageBlocked)throw Error('blocked');storage.set(key,value)},removeItem(key){storage.delete(key)}},PixkuyEventPackagesConfig:{t:key=>key,money:value=>String(value)},PixkuyEventPackagesApi:{config:async()=>({site:'synthetic-site'}),quote:()=>new Promise(resolve=>quotes.push(resolve)),recover:async attempt=>{calls.push({kind:'recover',attempt});if(settings.recoverReceipt)return {receipt};throw Error('RECOVERY_UNAVAILABLE')},submit:async(body,attempt)=>{calls.push({kind:'submit',body:JSON.parse(JSON.stringify(body)),attempt:{...attempt}});if(settings.failSubmit)throw Error('synthetic network failure');return {receipt}}}};
  const context={window,URL,Uint8Array,Date,Intl,Set,JSON,setTimeout,clearTimeout};
  for(const name of ['state','request']){const file=path.join(ROOT,`assets/js/services/events-package-${name}.js`);vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});}
  return {window,context,controller:window.PixkuyEventPackagesState,request:window.PixkuyEventPackagesRequest,storage,calls,quotes,receipt};
}
async function assertOrdinaryPackageInputs() {
  const runtime=packageRuntime();const {controller,window,context}=runtime;
  const file=path.join(ROOT,'assets/js/services/events-package-config.js');
  const source=fs.readFileSync(file,'utf8');const anchor='  window.PixkuyEventPackagesConfig={mount,open,t,money,load,closePackageDetailsDialog};';
  assert.equal(source.split(anchor).length-1,1);
  const eventListeners=new Map();
  window.addEventListener=(name,listener)=>{const listeners=eventListeners.get(name)||[];listeners.push(listener);eventListeners.set(name,listeners);};
  window.dispatchEvent=event=>{for(const listener of eventListeners.get(event.type)||[])listener(event);return true;};
  window.__pixkuyI18nDict={eventPackages:{choose:'Seleccionar',viewPackages:'Ver paquetes'},airportMobileContactStep:{fields:{phone:'Teléfono/WhatsApp con prefijo internacional'},placeholders:{phone:'Ej. +525512345678'},validation:{phone:'Indica un teléfono válido con formato internacional.'}},services:{cards:{events:{types:{festival:'Festival',other:'Evento'},panel:{dateLabel:'Fecha y hora',venueLabel:'Recinto',priceFromLabel:'Desde',posterAlt:'Cartel del evento',configurationTitle:'Configura tu traslado',quotePending:'Completa los datos para calcular el precio.',quoteLoading:'Calculando precio…',quoteUnavailable:'No se pudo calcular.'}},airport:{panel:{fareLabel:'Tarifa'}}}}};
  const bodyAttributes=new Map();let galleryFocus=0;
  context.document={documentElement:{lang:'es'},activeElement:null,addEventListener(){},querySelector(selector){return selector==='[data-events-mobile-vehicle-gallery-close]'?{focus(){galleryFocus++;}}:null;},body:{getAttribute(name){return bodyAttributes.has(name)?bodyAttributes.get(name):null;},setAttribute(name,value){bodyAttributes.set(name,value);},removeAttribute(name){bodyAttributes.delete(name);}},createElement(){return {attributes:{},setAttribute(name,value){this.attributes[name]=value;},remove(){this.removed=true;}};}};
  context.CustomEvent=class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}};
  vm.runInNewContext(source.replace(anchor,'  window.packageTestHooks={catalog,configuration,changeField,renderRoot,offer,customStrip,handleClick,lodgingCandidate,serviceBounds,boundedDateChoices,dateChoiceLabel,mobileReviewContact,mobileContactValidationFields,validateMobilePackageContact,airportQuoteReadiness,airportCanReview,scheduleAirportAutoQuote,cancelAirportAutoQuote,mountAddresses,roots,mountAirportSelector,mountClearableAddress,packageDetailsContent,changeRootField,validateField,mobileOrdinaryInputs,mobileBaseRecognized,mobileCalculationContent,airportAutoQuoteView};\n'+anchor),context,{filename:file});
  const event={id:'synthetic-event',publicationVersion:1,snapshot:{schemaVersion:3,customInquiryEnabled:true,translations:{es:{title:'Evento sintético'}},type:'festival',media:{main:{url:'/synthetic-event.webp'},mobile:{url:'/synthetic-event-mobile.webp'}},publicEventDates:{startLocalDate:'2026-10-30',endLocalDateExclusive:'2026-11-02',timeZone:'America/Mexico_City'},servicePeriod:{from:'2026-10-23T06:00:00.000Z',until:'2026-11-03T06:00:00.000Z'},occurrences:[{sourceLocalDateTime:'2026-10-29T08:00',dateLabelOverrides:{}},{sourceLocalDateTime:'2026-11-02T08:00',dateLabelOverrides:{}}],venue:{baseName:'Recinto sintético',translations:{es:{name:'Recinto sintético'}}},addOns:[],packages:[{id:'welcome',title:{es:'Welcome'},description:{es:'Prueba'},inclusions:[{es:'Recepción identificada'},{es:'Seguimiento del vuelo'},{es:'Traslado privado'}],options:[{id:'arrival',title:{es:'Llegada'},calculationModel:'ordinary_services',services:[{id:'arrival-service',ordinary:{baseService:'airport_transfer',restrictions:{fromDate:'2026-10-24',untilDate:'2026-11-01'},inputs:{direction:{source:'fixed',value:'airport_to_destination'},airportId:{source:'fixed',value:'mex'},destination:{source:'customer'},date:{source:'customer'},time:{source:'customer'},flight:{source:'deferred'},baggageStatus:{source:'customer'}}}}]}]}]}};
  controller.selectEvent(event,false);
  const initialOffer=window.packageTestHooks.configuration(controller.state);
  assert.ok(initialOffer.includes('data-package-configure="welcome"'));
  assert.ok(!initialOffer.includes('events-package-selected'));
  assert.ok(!initialOffer.includes('events-package-contact'));
  assert.ok(!initialOffer.includes('data-package-action="quote"'));
  assert.ok(initialOffer.includes('events-package-config__header--package'));
  assert.ok(initialOffer.includes('Elija su paquete'));
  assert.ok(initialOffer.includes('Modalidad disponible'));
  assert.ok(initialOffer.includes('Llegada · 1 traslado'));
  assert.ok(initialOffer.includes('Configurar traslado'));
  assert.ok(initialOffer.includes('Ver todas las inclusiones y condiciones'));
  assert.equal((initialOffer.match(/class="events-package-offer__disclosure"/g)||[]).length,1);
  assert.ok(initialOffer.includes('<h5>Qué incluye (3)</h5>'));
  assert.ok(initialOffer.includes('<h5>Condiciones (0)</h5>'));
  assert.ok(!initialOffer.includes('Ver las 3 inclusiones'));
  assert.ok(initialOffer.includes('Para particulares, empresas y grupos con otros horarios o recorridos.'));
  assert.ok(!initialOffer.includes('¿Ningún paquete se ajusta'));
  assert.ok(!initialOffer.includes('2026-10-29'));
  assert.equal(initialOffer.split('Seguimiento del vuelo').length-1,2,'the compact list and its disclosure retain published inclusions without injecting an operational date');
  const mobileOffer=window.packageTestHooks.configuration(controller.state,'mobile');
  const mobileHeader=mobileOffer.slice(0,mobileOffer.indexOf('</header>'));
  assert.ok(!mobileHeader.includes('data-package-action="ordinary-custom"'),'mobile removes the duplicated header entry');
  assert.ok(mobileOffer.includes('data-package-action="details"'),'mobile opens complete editorial detail through its auxiliary window');
  assert.ok(!mobileOffer.includes('events-package-offer__disclosure'),'mobile does not expand full detail inside the offer card');
  const detailCopy=window.packageTestHooks.packageDetailsContent({...event,snapshot:{...event.snapshot,conditions:[{title:{es:'Condición extensa'},description:{es:'Descripción completa de la condición'}}]}},event.snapshot.packages[0],true);
  assert.ok(detailCopy.includes('Condición extensa'));assert.ok(detailCopy.includes('Descripción completa de la condición'));
  assert.equal(controller.choose('welcome',''),true);
  assert.equal(controller.state.selection.optionId,'arrival');
  assert.ok(!window.packageTestHooks.configuration(controller.state).includes('data-package-field="option"'));
  controller.go('services');
  assert.equal(controller.state.selection.contractVersion,3);
  const effectiveBounds=window.packageTestHooks.serviceBounds(event.snapshot.packages[0].options[0].services[0],controller.state);
  assert.equal(effectiveBounds.minDate,'2026-10-24','the published service restriction wins over the wider event period');
  assert.equal(effectiveBounds.maxDate,'2026-11-01');
  const boundedMobile=window.packageTestHooks.configuration(controller.state,'mobile');
  assert.ok(boundedMobile.includes('data-package-date-choice'),'a finite mobile service period uses a closed date choice');
  assert.ok(boundedMobile.includes('value="2026-10-24"'));
  assert.ok(boundedMobile.includes('value="2026-11-01"'));
  assert.equal(window.packageTestHooks.dateChoiceLabel('2026-10-24'),'24/10/2026','the selected mobile date remains fully readable in the local compact format');
  assert.ok(!boundedMobile.includes('value="2026-10-23"'));
  assert.ok(!boundedMobile.includes('value="2026-11-02"'));
  assert.ok(!boundedMobile.includes('type="date"'),'the bounded mobile path never delegates range enforcement to the iOS date picker');
  assert.equal(window.packageTestHooks.boundedDateChoices('','2026-11-01'),null,'an unbounded legacy configuration retains its existing native fallback');
  assert.equal(window.packageTestHooks.boundedDateChoices('2026-11-02','2026-11-01').length,0,'an empty effective interval exposes no selectable date');
  controller.change(selection=>{selection.services=[{serviceId:'arrival-service',ordinaryInputs:{date:'2026-09-26'}}];});
  const invalidPreservedDate=window.packageTestHooks.configuration(controller.state,'mobile');
  assert.ok(invalidPreservedDate.includes('data-package-date-choice'));
  assert.ok(invalidPreservedDate.includes('data-package-field-error'),'a date invalidated by current published bounds is explained beside the field');
  assert.ok(!invalidPreservedDate.includes('value="2026-09-26"'),'an invalid prior date is never inserted into the closed choice');
  controller.change(selection=>{selection.services=[];});
  let blurRenders=0;const stopBlur=controller.subscribe(()=>{blurRenders++;});
  const mobileRoot={getAttribute:()=> 'mobile'};
  const timeTarget={type:'time',value:'12:30',getAttribute:()=> 'service:arrival-service:ordinary-time'};
  controller.state.quote={calculation:{}};controller.state.quoteStatus='ready';
  window.packageTestHooks.changeRootField(mobileRoot,timeTarget);
  assert.equal(blurRenders,0,'blur must preserve the conditions trigger between mousedown and click');
  assert.equal(controller.state.quote,null,'a changed mobile field still invalidates an old quote');
  assert.equal(controller.state.selection.services.find(s=>s.serviceId==='arrival-service').ordinaryInputs.time,'12:30');
  timeTarget.value='';window.packageTestHooks.changeRootField(mobileRoot,timeTarget);
  assert.equal(blurRenders,0);stopBlur();
  let dateChoiceRenders=0;const stopDateChoice=controller.subscribe(()=>{dateChoiceRenders++;});
  const dateChoiceTarget={type:'select-one',value:'2026-10-24',hasAttribute:()=>false,getAttribute:()=> 'service:arrival-service:ordinary-date',parentElement:{querySelector:()=>null}};
  window.packageTestHooks.changeRootField(mobileRoot,dateChoiceTarget);
  assert.equal(dateChoiceRenders,0,'choosing a bounded mobile date must not replace and refocus the active select');
  assert.equal(controller.state.selection.services.find(s=>s.serviceId==='arrival-service').ordinaryInputs.date,'2026-10-24');
  dateChoiceTarget.value='2026-11-01';window.packageTestHooks.changeRootField(mobileRoot,dateChoiceTarget);
  assert.equal(dateChoiceRenders,0,'a second bounded date choice also updates without a duplicate render');
  assert.equal(controller.state.selection.services.find(s=>s.serviceId==='arrival-service').ordinaryInputs.date,'2026-11-01');
  stopDateChoice();
  const html=window.packageTestHooks.configuration(controller.state);
  assert.ok(!html.includes('events-package-step-one'),'offer-only CSS cannot match service step');
  assert.ok(html.includes('events-package-layout'));
  assert.ok(!html.includes('events-package-layout__aside'));
  assert.ok(html.includes('events-package-layout__actions'));
  assert.ok(html.includes('events-package-primary-form'));
  assert.ok(html.includes('events-package-ordinary__route'));
  assert.ok(html.includes('events-package-ordinary__details'));
  assert.ok(html.includes('MEX'));
  assert.ok(!html.includes('ordinary-airportId'));assert.ok(html.includes('ordinary-destination'));
  assert.ok(!html.includes('ordinary-direction'));assert.ok(!html.includes('ordinary-flight'));
  assert.ok(html.includes('Pendiente para coordinación posterior'));assert.ok(html.includes('Pixkuy calcula el precio'));
  assert.ok(!html.includes('puede quedar pendiente'));assert.ok(html.includes('Número de maletas (opcional)'));assert.ok(html.includes('Puede indicarlo si desea facilitar la coordinación.'));
  const requestOnlyQuote={calculation:{calculationModel:'ordinary_services',coverageStatus:'verified',availability:{status:'unavailable'},serviceCount:1,pendingCodes:[],conditions:[{title:{es:'Solicitudes y confirmación'},description:{es:'Todas las solicitudes conservan su texto completo.'}}],serviceLines:[],priceBreakdown:{priceStatus:'quoted',pricedSubtotal:'12345',currency:'MXN',automaticAddOns:[]}}};
  assert.equal(window.packageTestHooks.airportCanReview({quoteStatus:'ready',quote:requestOnlyQuote}),true,'the Events review gate does not consult vehicle availability');
  controller.state.quote=requestOnlyQuote;controller.state.quoteStatus='ready';
  const requestOnlyMobile=window.packageTestHooks.configuration(controller.state,'mobile');
  assert.ok(requestOnlyMobile.includes('events-package-vehicle-card'));
  assert.ok(requestOnlyMobile.includes('assets/img/fleet/bydm9_xhoras001d.jpeg'));
  assert.ok(requestOnlyMobile.includes('Van Premium · BYD M9 o similar'));
  assert.ok(requestOnlyMobile.includes('data-package-action="vehicle-gallery"'));
  assert.ok(requestOnlyMobile.includes('<span>123.45</span><span class="events-package-vehicle-card__currency">MXN</span>'));
  assert.ok(requestOnlyMobile.includes('data-package-action="contact"'),'the mobile CTA hands off only to Events review');
  assert.ok(requestOnlyMobile.includes('>Continuar</button>'));
  assert.ok(!requestOnlyMobile.includes('Disponibilidad confirmada'));
  assert.ok(!requestOnlyMobile.includes('Disponibilidad pendiente'));
  const card=requestOnlyMobile.slice(requestOnlyMobile.indexOf('<section class="events-package-vehicle-card"'),requestOnlyMobile.indexOf('</section>',requestOnlyMobile.indexOf('<section class="events-package-vehicle-card"'))+'</section>'.length);
  assert.ok(card.endsWith('>Continuar</button></section>'),'the request card ends at the Events review CTA');
  const stateBeforeReceiptScroll={requestStatus:controller.state.requestStatus,screen:controller.state.screen,receipt:controller.state.receipt,selection:controller.state.selection,contact:controller.state.contact,quote:controller.state.quote,quoteStatus:controller.state.quoteStatus,error:controller.state.error,recoveryNotice:controller.state.recoveryNotice};
  const receiptRoute={scrollTop:468};let receiptHeadingFocus=0,previousFieldBlur=0,receiptFrames=0;
  const previousField={selectionStart:0,selectionEnd:0,getAttribute(){return 'contact:name';},blur(){previousFieldBlur++;}};
  const receiptHeading={focus(options){receiptHeadingFocus++;assert.equal(options?.preventScroll,true);}};
  const receiptRoot={
    attributes:{'data-event-package-root':'mobile'},innerHTML:'',packageAddresses:[],parentElement:null,
    setAttribute(name,value){this.attributes[name]=value;},getAttribute(name){return this.attributes[name]||null;},
    contains(node){return node===previousField;},closest(selector){return selector==='.events-mobile-route'?receiptRoute:null;},
    querySelectorAll(){return [];},querySelector(selector){return selector==='[data-package-confirmation-title]'&&this.innerHTML.includes('data-package-confirmation-title')?receiptHeading:null;}
  };
  const previousRaf=window.requestAnimationFrame,previousActive=context.document.activeElement;
  window.requestAnimationFrame=callback=>{receiptFrames++;callback();};
  controller.state.requestStatus='submitting';controller.state.screen='contact';controller.state.receipt=null;controller.state.selection={requestKind:'package',packageId:'welcome',optionId:'arrival',passengerBand:'van_1_2',services:[]};
  context.document.activeElement=previousField;window.packageTestHooks.renderRoot(receiptRoot);
  const receiptForScroll={...runtime.receipt,reference:'EVT-SCROLL-SYNTHETIC',requestKind:'package',priceStatus:'quoted',pricedSubtotal:'12345',currency:'MXN',confirmation:{eventTitle:{es:'Evento de recibo'},packageTitle:{es:'Paquete'},optionTitle:{es:'Opción'},services:[],conditions:[{title:{es:'Condición'},description:{es:'Texto completo'}}]}};
  controller.state.receipt=receiptForScroll;controller.state.requestStatus='received';controller.state.screen='receipt';controller.state.selection=null;context.document.activeElement=previousField;
  window.packageTestHooks.renderRoot(receiptRoot);
  assert.equal(previousFieldBlur,1,'a successful mobile receipt closes the prior field before replacing its DOM');
  assert.equal(receiptRoute.scrollTop,0,'the fixed mobile route, not window, is reset after the receipt renders');
  assert.equal(receiptHeadingFocus,1,'the confirmation heading receives accessible focus without scrolling');
  assert.ok(receiptRoot.innerHTML.includes('EVT-SCROLL-SYNTHETIC'),'the first rendered receipt content includes its reference');
  receiptRoute.scrollTop=97;window.packageTestHooks.renderRoot(receiptRoot);
  assert.equal(receiptRoute.scrollTop,97,'ordinary receipt rerenders and Conditions preserve the current route position');
  assert.equal(receiptHeadingFocus,1,'only the effective success transition moves focus');
  assert.equal(receiptFrames,1,'the receipt reset schedules one deterministic post-render frame');
  const desktopRoute={scrollTop:215};
  const desktopReceiptRoot={...receiptRoot,attributes:{'data-event-package-root':'desktop'},closest(selector){return selector==='.events-mobile-route'?desktopRoute:null;},contains(){return false;}};
  controller.state.requestStatus='submitting';controller.state.screen='contact';controller.state.receipt=null;controller.state.selection={requestKind:'package',packageId:'welcome',optionId:'arrival',passengerBand:'van_1_2',services:[]};
  window.packageTestHooks.renderRoot(desktopReceiptRoot);
  controller.state.receipt=receiptForScroll;controller.state.requestStatus='received';controller.state.screen='receipt';controller.state.selection=null;window.packageTestHooks.renderRoot(desktopReceiptRoot);
  assert.equal(desktopRoute.scrollTop,215,'desktop confirmation rendering does not use the mobile route scroll reset');
  assert.equal(receiptFrames,1,'desktop confirmation rendering does not schedule a mobile frame');
  controller.state.requestStatus='error';controller.state.screen='contact';controller.state.receipt=null;receiptRoute.scrollTop=333;window.packageTestHooks.renderRoot(receiptRoot);
  assert.equal(receiptRoute.scrollTop,333,'an error keeps the user beside the submitted form');
  Object.assign(controller.state,stateBeforeReceiptScroll);window.requestAnimationFrame=previousRaf;context.document.activeElement=previousActive;
  const mobileRoute={scrollTop:83};
  let mobileReviewFocus=0;
  const reviewRoot={
    attributes:{'data-event-package-root':'mobile'},innerHTML:'',parentElement:null,
    setAttribute(name,value){this.attributes[name]=value;},getAttribute(name){return this.attributes[name]||null;},contains(){return false;},closest(selector){return selector==='.events-mobile-route'?mobileRoute:null;},
    querySelectorAll(){return [];},querySelector(selector){return selector==='[data-package-heading]'?{focus(){mobileReviewFocus++;}}:null;}
  };
  let mobileRouteCloses=0,desktopHandoffs=0;
  window.PixkuyEventsMobileBookingFlow={close(){mobileRouteCloses++;}};
  window.addEventListener('pixkuy:events-special-panel-submit',()=>{desktopHandoffs++;});
  await window.packageTestHooks.handleClick(reviewRoot,{target:{closest:()=>({disabled:false,getAttribute:name=>name==='data-package-action'?'contact':null})}});
  assert.equal(controller.state.step,'review');
  assert.equal(controller.state.screen,'contact');
  assert.equal(mobileRouteCloses,0,'mobile review stays inside the Events route');
  assert.equal(desktopHandoffs,0,'mobile review does not activate the desktop contact handoff');
  assert.equal(runtime.calls.filter(call=>call.kind==='submit').length,0,'Continue only changes screen');
  await window.packageTestHooks.handleClick(reviewRoot,{target:{closest:()=>({disabled:false,getAttribute:name=>name==='data-package-action'?'contact':null})}});
  assert.equal(controller.state.screen,'contact','a repeated Continue remains on the same review screen');
  assert.equal(runtime.calls.filter(call=>call.kind==='submit').length,0,'a repeated Continue cannot submit or duplicate an attempt');
  window.packageTestHooks.renderRoot(reviewRoot);
  assert.ok(reviewRoot.innerHTML.includes('data-package-mobile-contact'),'the review/contact screen is rendered instead of a blank route');
  assert.ok(reviewRoot.innerHTML.includes('data-package-action="edit-services"'));
  assert.ok(reviewRoot.innerHTML.includes('data-package-action="submit"'));
  assert.ok(reviewRoot.innerHTML.includes('data-package-field="contact:name"'));
  assert.ok(reviewRoot.innerHTML.includes('data-package-mobile-contact-form'),'mobile package contact supplies the canonical validation form boundary');
  assert.ok(reviewRoot.innerHTML.includes('data-package-canonical-phone'),'mobile package contact marks telephone for the shared validator');
  assert.ok(reviewRoot.innerHTML.includes('data-error-for="phone"'),'mobile package contact exposes the canonical telephone error node');
  assert.ok(reviewRoot.innerHTML.includes('Teléfono/WhatsApp con prefijo internacional'));
  assert.ok(reviewRoot.innerHTML.includes('placeholder="Ej. +525512345678"'));
  assert.ok(reviewRoot.innerHTML.includes('data-i18n="airportMobileContactStep.validation.phone"'));
  assert.ok(!reviewRoot.innerHTML.includes('data-package-contact-validation'),'mobile contact contains no fabricated ordinary-form fields');
  const mobilePhoneControl=reviewRoot.innerHTML.match(/<input[^>]*data-package-field="contact:phone"[^>]*>/)?.[0]||'';
  assert.ok(mobilePhoneControl.includes('name="phone"'));
  assert.ok(!mobilePhoneControl.includes('pattern='),'Events does not retain a divergent native telephone pattern');
  assert.ok(source.includes("forms?.getReservationForm?.()"));
  assert.ok(source.includes("forms.refreshReservationRequestValidationUX(fields,name)"));
  assert.ok(source.includes('forms.getReservationRequestData(fields)'));
  assert.ok(!source.includes('function normalizePhone'),'Events does not copy the canonical telephone normalizer');
  assert.ok(reviewRoot.innerHTML.includes('data-package-review-conditions'),'mobile review exposes Conditions through the canonical dialog trigger');
  assert.ok(!reviewRoot.innerHTML.includes('<details>'),'mobile review never retains the inline breakdown accordion');
  const reviewConditionsCopy=window.packageTestHooks.packageDetailsContent(event,event.snapshot.packages[0],true,true,requestOnlyQuote.calculation.conditions);
  assert.ok(reviewConditionsCopy.includes('<strong>Solicitudes y confirmación</strong><p>Todas las solicitudes conservan su texto completo.</p>'),'canonical dialog markup keeps condition title and description separate and complete');
  assert.equal(mobileRoute.scrollTop,0);
  assert.ok(mobileReviewFocus>0);
  window.packageTestHooks.renderRoot(reviewRoot);
  assert.ok(reviewRoot.innerHTML.includes('data-package-mobile-contact'),'re-entering the active Events route restores the same review screen');
  await window.packageTestHooks.handleClick(reviewRoot,{target:{closest:()=>({disabled:false,getAttribute:name=>name==='data-package-action'?'edit-services':null})}});
  assert.equal(controller.state.step,'services');
  assert.equal(controller.state.selection.services.length,1,'editing from review preserves the configured itinerary');
  controller.state.quote=requestOnlyQuote;controller.state.quoteStatus='ready';
  const galleryData=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/js/data/fleet-gallery.json'),'utf8')).vehicles.byd_m9;
  assert.equal(galleryData.images.filter(image=>image.active).length,8,'the Events gallery keeps the canonical BYD M9 image set');
  const previousMatchMedia=window.matchMedia;let galleryOpens=0;window.matchMedia=()=>({matches:true});window.requestAnimationFrame=callback=>callback();window.PixkuyEventsMobileVehicleGallery={open(index){galleryOpens++;assert.equal(index,0);return true;}};
  await window.packageTestHooks.handleClick(mobileRoot,{target:{closest:()=>({disabled:false,getAttribute:name=>name==='data-package-action'?'vehicle-gallery':null})}});
  assert.equal(galleryOpens,1);assert.equal(galleryFocus,1);assert.equal(bodyAttributes.get('data-events-mobile-config-screen'),'true');
  controller.state.quote={calculation:{...requestOnlyQuote.calculation,priceBreakdown:{...requestOnlyQuote.calculation.priceBreakdown,priceStatus:'personalized',pricedSubtotal:null}}};
  const personalizedMobile=window.packageTestHooks.configuration(controller.state,'mobile');
  assert.ok(!personalizedMobile.includes('events-package-vehicle-card'),'personalized pricing cannot expose a definitive fare card');
  assert.ok(!personalizedMobile.includes('data-package-action="contact"'),'Airport review remains inside the definitive quote card');
  window.matchMedia=previousMatchMedia;
  controller.state.quote=null;controller.state.quoteStatus='idle';
  assert.equal(html.split('Seguimiento del vuelo').length-1,0,'inclusions stay in the offer step rather than repeat in service forms');
  assert.equal(html.split('Hay datos o condiciones pendientes de valoración.').length-1,0,'generic assessment is not duplicated before a quote');
  const change=(key,value)=>window.packageTestHooks.changeField({getAttribute:()=>`service:arrival-service:ordinary-${key}`,value});
  controller.state.quote={source:'published',quoteFingerprint:'a'.repeat(64)};controller.state.quoteStatus='ready';
  change('destination','Dirección sintética');assert.equal(controller.state.quote,null);
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.address,'Dirección sintética');
  change('direction','destination_to_airport');assert.equal(controller.state.selection.services[0].ordinaryInputs.direction,undefined);
  change('destination','');assert.equal(controller.state.selection.services[0].ordinaryInputs.destination,undefined);
  controller.state.quoteStatus='ready';controller.state.quote={calculation:{calculationModel:'ordinary_services',coverageStatus:'outside',serviceCount:1,pendingCodes:['OUTSIDE'],conditions:[],priceBreakdown:{priceStatus:'personalized',pricedSubtotal:null,currency:'MXN',automaticAddOns:[]},serviceLines:[{serviceId:'arrival-service',baseMinorUnits:null,effectiveMultiplierBasisPoints:10000,resultMinorUnits:null,currency:'MXN',reasonCode:'AIRPORT_TRANSFER_ZONE_NOT_TARIFFED'}]}};
  controller.go('review');
  const outside=window.packageTestHooks.configuration(controller.state);assert.ok(!outside.includes('AIRPORT_TRANSFER_ZONE_NOT_TARIFFED'));assert.ok(outside.includes('data-package-action="ordinary-custom"'));assert.ok(!outside.includes('data-package-contact'));
  controller.state.quote.calculation.coverageStatus='pending';controller.state.quote.calculation.priceBreakdown.priceStatus='conditional';
  controller.state.quote.calculation.serviceLines[0].baseMinorUnits='12345';controller.state.quote.calculation.serviceLines[0].resultMinorUnits='12345';controller.state.quote.calculation.priceBreakdown.automaticAddOns=[{totalMinorUnits:'6789'}];
  const pending=window.PixkuyEventPackagesConfig.contactSummary(controller.state);assert.ok(!pending.includes('6789'));assert.ok(pending.includes('Hay datos o condiciones pendientes'));assert.ok(!pending.includes('data-package-contact'));assert.ok(!pending.includes('events-package-ordinary__route'));
  controller.selectEvent({...event,id:'fixed-event',snapshot:{...event.snapshot,schemaVersion:2}},false);assert.equal(controller.state.selection.contractVersion,undefined);
  const catalogEvent=event;
  const catalogHtml=window.packageTestHooks.catalog({catalogStatus:'ready',events:[{...catalogEvent,fromPrice:null}]});
  assert.ok(catalogHtml.includes('services-events-panel__event'));
  assert.ok(catalogHtml.includes('<article class="services-events-panel__event events-package-card'));
  assert.ok(catalogHtml.includes('<div class="services-events-panel__event-media"><picture>'));
  assert.ok(catalogHtml.includes('services-events-panel__event-image'));
  assert.ok(catalogHtml.includes('/synthetic-event.webp'));
  assert.ok(catalogHtml.includes('alt="Cartel del evento: Evento sintético"'));
  assert.ok(catalogHtml.includes('<source media="(max-width: 720px)" srcset="/synthetic-event-mobile.webp">'));
  assert.ok(catalogHtml.includes('<dt>Fechas</dt><dd>30 oct – 1 nov 2026</dd>'));
  assert.ok(!catalogHtml.includes('29 oct'));
  assert.ok(!catalogHtml.includes('2 nov'));
  assert.ok(catalogHtml.includes('Festival'));
  assert.ok(catalogHtml.includes('Recinto sintético'));
  assert.ok(catalogHtml.includes('Ver paquetes'));
  assert.ok(!catalogHtml.includes('events-package-card__secondary'));assert.ok(!catalogHtml.includes('Empresas y grupos'));assert.ok(window.packageTestHooks.customStrip({events:[catalogEvent]}).includes('Solicitar propuesta'));
  assert.ok(!catalogHtml.includes('MXN'));
  assert.ok(!catalogHtml.includes('<h3>Paquetes para eventos</h3>'));
  assert.ok(source.includes('data-events-unified-catalog'));
  const legacySnapshot={...catalogEvent.snapshot};delete legacySnapshot.publicEventDates;
  const legacyHtml=window.packageTestHooks.catalog({catalogStatus:'ready',events:[{...catalogEvent,id:'legacy-event',fromPrice:null,snapshot:legacySnapshot}]});
  assert.ok(!legacyHtml.includes('<dt>Fechas</dt>'));
  assert.ok(legacyHtml.includes('Recinto sintético'));
  const fallbackHtml=window.packageTestHooks.catalog({catalogStatus:'ready',events:[{...catalogEvent,id:'fallback-event',fromPrice:null,snapshot:{...catalogEvent.snapshot,media:{main:null,mobile:null}}}]});
  assert.ok(fallbackHtml.includes('events-package-card__media-fallback'));
  assert.ok(fallbackHtml.includes('<div class="services-events-panel__event-media"><div class="services-events-panel__event-image events-package-card__media-fallback"'));
  controller.selectEvent(catalogEvent,true);
  controller.change(selection=>{selection.inquiry.notes='Solicitud sintética que conserva el estado';});
  const customHtml=window.packageTestHooks.configuration(controller.state);
  assert.ok(!customHtml.includes('events-package-step-one'),'custom form retains its own presentation');
  assert.ok(customHtml.includes('events-package-layout'));
  assert.ok(customHtml.includes('events-package-field--wide'));
  assert.equal(customHtml.split('30 oct – 1 nov 2026').length-1,1);
  controller.state.quoteStatus='ready';controller.state.quote={calculation:{serviceCount:null,pendingCodes:['CUSTOM_ASSESSMENT'],conditions:[],priceBreakdown:{pricedSubtotal:null,priceStatus:'personalized',currency:'MXN'}}};controller.go('review');
  const contactHtml=window.PixkuyEventPackagesConfig.contactSummary(controller.state);
  assert.ok(!contactHtml.includes('events-package-step-one'),'offer-only CSS cannot match contact step');
  assert.ok(!contactHtml.includes('<form'));
  assert.ok(!contactHtml.includes('data-package-contact'));
  assert.equal(controller.state.selection.inquiry.notes,'Solicitud sintética que conserva el estado');
  controller.selectEvent(catalogEvent,false);controller.change(selection=>{selection.packageId='welcome';selection.optionId='arrival';selection.services=[{serviceId:'arrival-service',ordinaryInputs:{destination:{address:'Destino conservado'},date:'2027-10-29',time:'08:00'}}];});
  controller.state.events=[catalogEvent];controller.state.catalogStatus='ready';
  controller.state.quoteStatus='ready';controller.state.quote={source:'published',quoteFingerprint:'c'.repeat(64),calculation:{calculationModel:'ordinary_services',coverageStatus:'verified',serviceCount:1,pendingCodes:[],conditions:[],priceBreakdown:{priceStatus:'quoted',pricedSubtotal:'12500',currency:'MXN',automaticAddOns:[]},serviceLines:[{serviceId:'arrival-service',baseMinorUnits:'12500',effectiveMultiplierBasisPoints:10000,resultMinorUnits:'12500',currency:'MXN',reasonCode:null}]}};
  const customerSummary=window.PixkuyEventPackagesConfig.contactSummary(controller.state);
  for(const technicalLabel of ['Base:','Multiplicador','×1'])assert.ok(!customerSummary.includes(technicalLabel),'customer summary must omit '+technicalLabel);
  assert.ok(!customerSummary.includes('Servicios 1:'));
  assert.ok(customerSummary.includes('125.00 MXN'));
  for(const technicalSource of ["t('base')","t('multiplier')",'baseMinorUnits','effectiveMultiplierBasisPoints'])assert.ok(!source.includes(technicalSource),'client renderer must not consume '+technicalSource);
  const root={attributes:{'data-event-package-root':'desktop'},parentElement:null,innerHTML:'',setAttribute(name,value){this.attributes[name]=value;},getAttribute(name){return this.attributes[name]||null;},contains(){return false;},querySelectorAll(){return [];}};
  controller.go('review');
  window.packageTestHooks.renderRoot(root);
  assert.ok(root.innerHTML.includes('data-package-card="synthetic-event"'),'package card remains beside its open detail');
  assert.ok(!root.innerHTML.includes('events-package-detail'));
  assert.ok(!root.innerHTML.includes('Revisión y contacto'));
  assert.ok(window.PixkuyEventPackagesConfig.contactSummary(controller.state).includes('125.00 MXN'));
  assert.ok(!root.innerHTML.includes('Multiplicador'));
  assert.ok(!root.innerHTML.includes('×1'));
  assert.ok(!root.innerHTML.includes('data-package-contact'));
  window.dispatchEvent(new context.CustomEvent('pixkuy:events-detail-activated',{detail:{source:'special'}}));
  assert.equal(controller.state.screen,'catalog','V1 activation closes only the V2 detail');
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.address,'Destino conservado');
  assert.equal(controller.state.quote.quoteFingerprint,'c'.repeat(64));
  controller.selectEvent(catalogEvent,false);
  assert.equal(controller.state.screen,'config');
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.address,'Destino conservado');
  assert.equal(controller.state.quote.quoteFingerprint,'c'.repeat(64));
  const duplicateEvent={...catalogEvent,id:'duplicate-event',snapshot:{...catalogEvent.snapshot,packages:[{...catalogEvent.snapshot.packages[0],inclusions:[{es:'Repetida'},{es:'Repetida'}]}]}};
  controller.selectEvent(duplicateEvent,false);controller.change(s=>{s.packageId='welcome';s.optionId='arrival';});
  const duplicateHtml=window.packageTestHooks.configuration(controller.state);
  assert.equal(duplicateEvent.snapshot.packages[0].inclusions.length,2,'stored duplicate inclusions remain source data');
  const highlighted=duplicateHtml.match(/<ul class="events-package-offer__highlights">([\s\S]*?)<\/ul>/)[1];
  assert.equal(highlighted.split('Repetida').length-1,2,'duplicate source entries appear exactly once each in highlights');
  assert.equal(duplicateHtml.split('Repetida').length-1,4,'the complete disclosure repeats both entries intentionally');
  assert.ok(duplicateHtml.includes('<h5>Qué incluye (2)</h5>'));
  const detailedEvent=JSON.parse(JSON.stringify(duplicateEvent));
  detailedEvent.id='complete-details';
  detailedEvent.snapshot.conditions=[{title:{es:'Evento <seguro>'},description:{es:'Condición íntegra del evento'}}];
  detailedEvent.snapshot.packages[0].conditions=[{title:{es:'Paquete'},description:{es:'Condición íntegra del paquete'}}];
  detailedEvent.snapshot.packages[0].inclusions=Array.from({length:6},(_,i)=>({es:'Inclusión '+i}));
  controller.selectEvent(detailedEvent,false);
  const completeDetails=window.packageTestHooks.configuration(controller.state);
  assert.equal((completeDetails.match(/class="events-package-offer__disclosure"/g)||[]).length,1);
  assert.ok(completeDetails.includes('Evento &lt;seguro&gt;'));
  assert.ok(completeDetails.includes('Condición íntegra del evento'));
  assert.ok(completeDetails.includes('Condición íntegra del paquete'));
  assert.ok(completeDetails.includes('<h5>Qué incluye (6)</h5>'));
  for(let i=0;i<6;i++)assert.equal(completeDetails.split('Inclusión '+i).length-1,i<3?2:1);
  assert.ok(!completeDetails.includes('events-package-offer__subtitle'),'legacy packages have no invented subtitle');
  assert.ok(!completeDetails.includes('events-package-offer__highlight-icon'),'legacy inclusions have no inferred icons');
  const editorial=JSON.parse(JSON.stringify(detailedEvent));editorial.id='editorial-fields';
  const editorialPackage=editorial.snapshot.packages[0];
  editorialPackage.subtitle={es:'Subtítulo <sintético>',en:'Synthetic subtitle'};
  editorialPackage.inclusions=[
    {es:'Texto completo uno',en:'Full text one',summary:{es:'Resumen uno',en:'Summary one'},iconId:'plane'},
    {es:'Texto completo dos',summary:{es:'Resumen dos'},iconId:'users'},
    {es:'Texto completo tres',en:'Full text three',iconId:'clock'},
    {es:'Texto completo cuatro',summary:{es:'No destacar cuatro'},iconId:'plane'},
    {es:'Texto completo uno'},
  ];
  const sourceEditorial=JSON.stringify(editorial);
  controller.selectEvent(editorial,false);
  const highlightBlock=html=>html.match(/<ul class="events-package-offer__highlights">([\s\S]*?)<\/ul>/)[1];
  for(const lang of ['es','en','de','fr','it','ko','pt','ru','zh-hans']){
    window.__pixkuyI18nLang=lang;
    const html=window.packageTestHooks.configuration(controller.state), highlights=highlightBlock(html);
    assert.ok(html.includes(lang==='en'?'Synthetic subtitle':'Subtítulo &lt;sintético&gt;'));
    assert.ok(highlights.includes(lang==='en'?'Summary one':'Resumen uno'));
    assert.ok(highlights.includes('Resumen dos'),'summary falls back independently to Spanish');
    assert.ok(highlights.includes(lang==='en'?'Full text three':'Texto completo tres'),'absent summary uses complete localized text');
    assert.equal((highlights.match(/<svg /g)||[]).length,3);
    assert.ok(highlights.indexOf('uno')<highlights.indexOf('dos')||lang==='en');
    assert.ok(!highlights.includes('cuatro'));
    const disclosure=html.slice(html.indexOf('<details class="events-package-offer__disclosure"'));
    assert.ok(disclosure.includes(lang==='en'?'Full text one':'Texto completo uno'));
    assert.ok(disclosure.includes('Texto completo dos'));
    assert.ok(disclosure.includes('Texto completo cuatro'));
    assert.ok(!disclosure.includes('Resumen uno'));
  }
  window.__pixkuyI18nLang='es';
  assert.equal(JSON.stringify(editorial),sourceEditorial,'rendering never edits or fills source data');
  const cleared=JSON.parse(sourceEditorial);cleared.id='empty-editorial';
  cleared.snapshot.packages[0].subtitle={es:'',en:''};
  cleared.snapshot.packages[0].inclusions=[{es:'Texto completo conservado',summary:{es:''}}];
  controller.selectEvent(cleared,false);
  const clearedHtml=window.packageTestHooks.configuration(controller.state);
  assert.ok(!clearedHtml.includes('events-package-offer__subtitle'));
  assert.ok(highlightBlock(clearedHtml).includes('Texto completo conservado'));
  assert.ok(!highlightBlock(clearedHtml).includes('<svg'));
  for(const iconId of ['<svg onload=alert(1)>','https://example.invalid/icon.svg','__proto__','constructor','unknown',undefined]){
    const invalid=JSON.parse(sourceEditorial);invalid.id='invalid-icon-'+String(iconId);
    invalid.snapshot.packages[0].inclusions=[{es:'Texto completo',summary:{es:'<script>synthetic</script>'},iconId}];
    controller.selectEvent(invalid,false);
    const html=window.packageTestHooks.configuration(controller.state), highlights=highlightBlock(html);
    assert.ok(!highlights.includes('<svg'));
    assert.ok(!highlights.includes('<script>'));
    assert.ok(highlights.includes('&lt;script&gt;synthetic&lt;/script&gt;'));
  }
  console.log(JSON.stringify({status:'PASS',suite:'package-editorial-rendering',cases:['legacy-fields-absent','subtitle-localized-escaped','nine-locale-fallback','summary-or-full','closed-local-icons','unknown-icons-omitted','three-highlights-in-source-order','full-disclosure-and-duplicates','render-does-not-mutate'],externalCalls:0,visualAcceptance:false}));
  const hooks=window.packageTestHooks;
  const multi=JSON.parse(JSON.stringify(event));multi.id='multi-event';
  const first=multi.snapshot.packages[0];first.active=true;
  first.options.push({...JSON.parse(JSON.stringify(first.options[0])),id:'return',title:{es:'Ida y vuelta'}});
  first.options[1].services.push({...JSON.parse(JSON.stringify(first.options[0].services[0])),id:'departure-service',ordinary:{...JSON.parse(JSON.stringify(first.options[0].services[0].ordinary)),inputs:{...JSON.parse(JSON.stringify(first.options[0].services[0].ordinary.inputs)),direction:{source:'fixed',value:'destination_to_airport'}}}});
  multi.snapshot.packages.push({...JSON.parse(JSON.stringify(first)),id:'disabled',active:false,title:{es:'Hidden synthetic'}});
  controller.selectEvent(multi,false);assert.equal(controller.state.selection.packageId,'');
  assert.ok(!hooks.offer(controller.state).includes('Hidden synthetic'));
  controller.choose('welcome','');assert.equal(controller.state.selection.optionId,'','multiple options are never arbitrarily selected');
  assert.ok(hooks.offer(controller.state).includes('type="radio"'));
  assert.equal(controller.go('services'),false);
  controller.choose('welcome','arrival');controller.go('services');
  controller.change(s=>{s.services=[{serviceId:'arrival-service',ordinaryInputs:{destination:{address:'Synthetic hotel',placeId:'synthetic-place'},date:'2026-10-29',time:'09:00'}}];s.passengerBand='van_5_6';});
  controller.state.contact.name='Synthetic contact';
  controller.go('package');assert.equal(controller.state.selection.passengerBand,'van_5_6');
  assert.equal(controller.choose('welcome','return',()=>{throw Error('compatible services must not ask to discard')}),true);
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,'synthetic-place');
  controller.go('services');const twoServices=hooks.configuration(controller.state);
  assert.ok(twoServices.includes('data-package-service="departure-service"'));
  assert.ok(twoServices.includes('Hora de recogida (CDMX)'));
  assert.ok(twoServices.includes('data-package-reuse="departure-service"'));
  controller.change(s=>s.services.push({serviceId:'departure-service',ordinaryInputs:{destination:{address:'Different synthetic hotel'}}}));
  assert.equal(controller.choose('welcome','arrival',()=>false),false);
  assert.equal(controller.state.selection.optionId,'return');
  assert.equal(controller.choose('welcome','arrival',()=>true),true);
  assert.equal(controller.state.selection.services.length,1);
  controller.selectEvent(multi,true);controller.change(s=>{s.inquiry.notes='Synthetic custom schedule and route';});controller.state.contact.name='Custom contact';
  controller.selectEvent(multi,false);assert.equal(controller.state.contact.name,'Synthetic contact');assert.equal(controller.state.selection.passengerBand,'van_5_6');
  controller.selectEvent(multi,true);assert.equal(controller.state.selection.inquiry.notes,'Synthetic custom schedule and route');assert.equal(controller.state.contact.name,'Custom contact');
  const closed={...multi,id:'no-custom',snapshot:{...multi.snapshot,customInquiryEnabled:false}};
  assert.equal(controller.selectEvent(closed,true),false);assert.equal(hooks.customStrip({events:[closed]}),'');
  assert.ok(hooks.customStrip({events:[multi,event],customPicker:true}).includes('data-package-custom="multi-event"'));
  controller.selectEvent(multi,false);controller.go('services');
  const saved=controller.state.selection.services[0];assert.equal(saved.ordinaryInputs.destination.placeId,'synthetic-place');
  hooks.changeField({getAttribute:()=> 'service:arrival-service:ordinary-destination',value:'Edited synthetic hotel'},true);
  assert.equal(saved.ordinaryInputs.destination.placeId,undefined,'free edit invalidates canonical place identity');assert.equal(controller.state.quote,null);
  let addressOptions=null,focusAddress=null,mountCalls=0;
  const input={addEventListener(name,listener){if(name==='focus')focusAddress=listener;}};
  const host={getAttribute:()=> 'service:arrival-service:ordinary-destination',querySelector:selector=>selector==='input'?input:selector==='[data-package-address-clear]'?null:{}};
  window.PixkuyServicesEventsSpecialAddress={mount(options){mountCalls++;addressOptions=options;return {destroy(){}};}};
  hooks.mountAddresses({querySelectorAll:()=>[host]});assert.equal(mountCalls,0,'canonical Places mounts only on deliberate focus');focusAddress();assert.equal(mountCalls,1);
  addressOptions.onPlaceSelected({label:'Selected synthetic hotel',placeId:'selected-synthetic-place',lat:19,lng:-99});
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,'selected-synthetic-place');assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.lat,undefined,'only existing contract fields are sent');
  const oldSelection=controller.state.selection;controller.selectEvent(multi,true);addressOptions.onPlaceSelected({label:'Late callback',placeId:'late'});assert.equal(oldSelection.services[0].ordinaryInputs.destination.address,'Selected synthetic hotel');controller.selectEvent(multi,false);controller.go('services');
  window.PixkuyServicesEventsSpecialAddress=null;
  const quoteResult={source:'published',quoteFingerprint:'d'.repeat(64),calculation:{calculationModel:'ordinary_services',coverageStatus:'verified',serviceCount:1,pendingCodes:[],conditions:[],itinerary:{services:[{id:'arrival-service',startLocal:'2026-10-29T09:00'}]},priceBreakdown:{priceStatus:'quoted',pricedSubtotal:'12500',currency:'MXN',automaticAddOns:[]},serviceLines:[]}};
  root.querySelector=()=>null;
  const click=action=>hooks.handleClick(root,{target:{closest:()=>({disabled:false,getAttribute:name=>name==='data-package-action'?action:null})}});
  const calculating=click('quote');assert.equal(runtime.quotes.length,1,'one explicit quote request');runtime.quotes[0](quoteResult);await calculating;
  assert.equal(controller.state.step,'services','desktop Airport exposes its price before review');
  await click('airport-review');
  assert.equal(controller.state.step,'review');assert.equal(controller.state.selection.locale,'es');
  const review=window.PixkuyEventPackagesConfig.contactSummary(controller.state);assert.ok(!review.includes('2026-10-29T09:00'));assert.ok(review.includes('29 de octubre de 2026'));assert.ok(!review.includes('data-package-contact'));
  await click('back');assert.equal(controller.state.step,'services');assert.equal(controller.state.selection.passengerBand,'van_5_6');
  assert.equal(runtime.calls.filter(c=>c.kind==='submit').length,0,'navigation never submits');
  const backgroundQuote=click('quote');window.dispatchEvent(new context.CustomEvent('pixkuy:events-detail-activated',{detail:{source:'special'}}));runtime.quotes[1](quoteResult);await backgroundQuote;
  assert.equal(controller.state.screen,'catalog','a late quote cannot reopen V2 after V1 activation');controller.selectEvent(multi,false);controller.go('services');
  window.PixkuyEventPackagesApi.quote=async()=>{throw new Error('SYNTHETIC_PROVIDER_UNAVAILABLE')};await click('quote');assert.equal(controller.state.quoteStatus,'error');assert.equal(controller.state.step,'services');assert.equal(controller.state.selection.requestKind,'package');
  hooks.renderRoot(root);assert.ok(root.innerHTML.includes('role="alert"'));assert.ok(!root.innerHTML.includes('data-package-contact'));
  const mixed=JSON.parse(JSON.stringify(multi));mixed.id='mixed';mixed.snapshot.servicePeriod={from:'2026-10-29T06:00:00Z',until:'2026-11-03T06:00:00Z'};
  mixed.snapshot.days=[{id:'late',title:{es:'Second day'},date:'2026-10-30'},{id:'early',title:{es:'First day'},date:'2026-10-29'}];
  const mix=mixed.snapshot.packages[0].options[0];
  mix.services=[{id:'hourly',dayId:'late',ordinary:{baseService:'hourly_daily',inputs:{origin:{source:'customer'},date:{source:'fixed',value:'2026-10-30'},time:{source:'customer'},mode:{source:'fixed',value:'hourly'},durationHours:{source:'customer'},baggageStatus:{source:'deferred'}}}},{id:'direct',dayId:'early',ordinary:{baseService:'direct_transfer',inputs:{origin:{source:'fixed',redacted:true},destination:{source:'customer'},date:{source:'customer'},time:{source:'customer'},baggageStatus:{source:'customer'}}}}];
  controller.selectEvent(mixed,false);controller.choose('welcome','arrival');
  const mixedOffer=hooks.offer(controller.state);
  assert.ok(mixedOffer.includes('Servicios: 2'));
  assert.ok(!mixedOffer.includes('2 traslados'),'hourly blocks must not be described as transfers');
  controller.go('services');
  const mixedHtml=hooks.configuration(controller.state);assert.ok(mixedHtml.indexOf('data-package-service="direct"')<mixedHtml.indexOf('data-package-service="hourly"'));
  assert.ok(mixedHtml.includes('ordinary-durationHours'));assert.ok(mixedHtml.includes('min="2026-10-29"'));assert.ok(mixedHtml.includes('max="2026-11-02"'));assert.ok(!mixedHtml.includes('data-package-field="service:direct:ordinary-origin"'));assert.ok(mixedHtml.includes('Definido por el evento'));
  const fixed=JSON.parse(JSON.stringify(mixed));fixed.id='fixed-model';fixed.snapshot.schemaVersion=2;
  const fixedOption=fixed.snapshot.packages[0].options[0];fixedOption.calculationModel='fixed';fixedOption.rates={van_1_2:{status:'configured',minorUnits:'19000',currency:'MXN'}};
  fixedOption.services=[{id:'fixed-trip',dayId:'early',kind:'trip',from:{kind:'airport',airportCode:'MEX'},to:{kind:'lodging_or_address'},startLocal:'2026-10-29T08:00',durationHours:null,allowDeferredTime:false},{id:'optional-block',dayId:'late',kind:'block',from:{kind:'venue'},to:{kind:'venue'},startLocal:null,durationHours:12,allowDeferredTime:true}];
  fixed.snapshot.addOns=[{id:'addon',kind:'additional_exclusive_block',packageId:'welcome',optionIds:['arrival'],serviceIds:['optional-block'],title:{es:'Published add-on'}}];
  controller.selectEvent(fixed,false);controller.choose('welcome','arrival');assert.ok(hooks.offer(controller.state).includes('190.00 MXN'));controller.go('services');
  const fixedHtml=hooks.configuration(controller.state);assert.ok(fixedHtml.includes('data-package-band="van_1_2"'));assert.ok(!fixedHtml.includes('data-package-field="service:fixed-trip:startLocal"'));assert.ok(!fixedHtml.includes('data-package-field="service:fixed-trip:fromAirport"'));assert.ok(fixedHtml.includes('service:optional-block:additional'));
  hooks.changeField({getAttribute:()=> 'service:optional-block:additional',value:'',checked:true});assert.ok(hooks.configuration(controller.state).includes('service:optional-block:startLocal'));
  assert.ok(!hooks.configuration(controller.state).includes('value="none" selected'));
  const many=JSON.parse(JSON.stringify(fixed));many.id='many';many.snapshot.packages[0].options=Array.from({length:5},(_,i)=>({...JSON.parse(JSON.stringify(fixedOption)),id:'option-'+i}));
  controller.selectEvent(many,false);controller.choose('welcome','');assert.ok(hooks.offer(controller.state).includes('<select data-package-field="option">'));assert.equal(controller.state.selection.optionId,'');
  console.log(JSON.stringify({status:'PASS',suite:'event-packages-three-step',cases:['offer-without-premature-contact','single-option-direct','multiple-options-explicit','disabled-hidden','compatible-back','compatible-option-preserved','incompatible-option-confirmation','separate-custom-memory','custom-disabled','custom-event-resolution','free-place-edit-invalidates','quote-state-before-review','review-before-contact','navigation-never-submits','temporary-failure-no-custom-switch','airport-return-independent','explicit-lodging-reuse','direct-private-fixed','hourly-duration','chronological-days','operational-date-bounds','fixed-passenger-bands','fixed-values-not-editable','published-addons','baggage-not-preselected','many-options-selector'],externalCalls:0,visualAcceptance:false}));
  const css=fs.readFileSync(path.join(ROOT,'assets/css/events-packages.css'),'utf8');
  assert.ok(css.includes('.events-catalog-grid'));
  assert.ok(css.includes('.events-package-ordinary__route'));
  assert.ok(css.includes('.events-package-detail'));
  assert.ok(!css.includes('.events-package-layout__aside'));
  assert.ok(!css.includes('aspect-ratio: 16 / 7'));
  assert.ok(css.includes('word-break: normal'));
  assert.ok(css.includes('@media (max-width: 720px)'));
  assert.ok(css.includes('.events-package-config__header--package'));
  assert.ok(css.includes('.events-package-offer__highlights'));
  console.log(JSON.stringify({status:'PASS',suite:'event-packages-step-one-reference',cases:['one-native-disclosure','all-inclusions-and-both-condition-scopes','published-copy-and-duplicates-preserved','html-escaped','tailored-footer-copy','service-contact-custom-scope-isolation','mixed-services-not-transfers'],externalCalls:0,computedStylesVerified:false,visualAcceptance:false}));
  await assertAirportDesktop(runtime,event,hooks,root);
  await assertSharedPackageContact(runtime,event);
  const traditionalSource=fs.readFileSync(path.join(ROOT,'assets/js/services/events-special-panel.js'),'utf8');
  assert.ok(traditionalSource.includes('detail: { source: "special" }'));
  assert.ok(traditionalSource.includes('deactivateForPackageDetail'));
  assert.ok(traditionalSource.includes('event.detail.source === "packages"'));
  assert.ok(!source.includes('effectiveMultiplierBasisPoints*'));
  console.log(JSON.stringify({status:'PASS',suite:'event-packages-ordinary-inputs',cases:['v3-explicit','customer-only','fixed-visible','deferred-explained','economic-change-invalidates','empty-input-pending','outside-custom-explicit','outside-no-contact','pending-not-personalized','customer-calculation-internals-hidden','v2-compatible','no-local-pricing','request-only-review-no-availability-gate','quoted-mobile-vehicle-card','canonical-eight-image-gallery','personalized-without-definitive-card','shared-catalog-card','canonical-media-container','media-title-alt','responsive-mobile-media','media-fallback','public-exclusive-date-range','operational-days-isolated','public-venue-summary','legacy-snapshot-without-public-dates','single-detail-public-summary','single-column-airport-layout','catalog-detail-persistence','v1-v2-v1-state-preservation','stale-quote-protection','labels-match-source','single-render-per-inclusion','stored-duplicates-preserved','compact-actions','mobile-rule-preserved','receipt-success-scroll-reset-once','receipt-rerender-preserves-scroll','receipt-error-preserves-form-position','desktop-receipt-preserves-scroll'],externalCalls:0,visualAcceptance:false}));
}
async function assertSharedPackageContact(runtime, event) {
  const {window,context,controller}=runtime;
  const confirmationFocus=[];
  // Extend this runner's DOM boundary; all navigation, state and validation are real modules.
  const dataKey=name=>name.replace(/^data-/,'').replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
  const node=(tagName='div')=>{
    let html='';
    const item={value:'',dataset:{},attributes:{},hidden:false,disabled:false,children:[],listeners:{},className:'',textContent:'',tagName:tagName.toUpperCase(),
      focus(options){this.focused=true;if(this.getAttribute('data-package-confirmation-title')!==null)confirmationFocus.push({kind:'focus',options});},scrollIntoView(options){if(this.getAttribute('data-package-confirmation-title')!==null)confirmationFocus.push({kind:'viewport',options});},after(child){this.sibling=child;child.parentElement=this.parentElement;},
      setAttribute(key,value){this.attributes[key]=String(value);if(key.startsWith('data-'))this.dataset[dataKey(key)]=String(value);},getAttribute(key){return key.startsWith('data-')?this.dataset[dataKey(key)]??this.attributes[key]??null:this.attributes[key]??null;},removeAttribute(key){delete this.attributes[key];if(key.startsWith('data-'))delete this.dataset[dataKey(key)];},
      addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},dispatchEvent(e){for(const fn of this.listeners[e.type]||[])fn(e);},
      matches(selector){const className=selector.match(/^\.([\w-]+)/)?.[1];if(className&&!this.className.split(/\s+/).includes(className))return false;const tag=selector.match(/^[a-z]+/)?.[0];if(tag&&this.tagName!==tag.toUpperCase())return false;for(const match of selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)){const actual=this.getAttribute(match[1]);if(actual===null||(match[2]!==undefined&&actual!==match[2]))return false;}return Boolean(className||tag||selector.startsWith('['));},
      closest(selector){let current=this;while(current){if(current.matches?.(selector))return current;current=current.parentElement;}return null;},
      querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches?.(selector)?[child]:[]),...child.querySelectorAll(selector)]);},querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
      appendChild(child){child.parentElement=this;this.children.push(child);return child;},replaceChildren(...children){this.children=[];children.forEach(child=>this.appendChild(child));},contains(child){return this===child||this.children.some(node=>node.contains(child))}};
    item.classList={toggle(name,force){const names=new Set(item.className.split(/\s+/).filter(Boolean));const enabled=force===undefined?!names.has(name):force;if(enabled)names.add(name);else names.delete(name);item.className=Array.from(names).join(' ');},remove(name){this.toggle(name,false);},add(name){this.toggle(name,true);}};
    Object.defineProperty(item,'innerHTML',{get(){return html;},set(value){html=String(value);if(!value)item.children=[];if(html.includes('data-package-confirmation-title')){const heading=node('h3');heading.setAttribute('data-package-confirmation-title','');item.replaceChildren(heading);}}});
    return item;
  };
  const form=node(),legacy=node(),whatsapp=node(),fieldsByName=new Map(),ids=new Map();let navigations=0,v1Handoffs=0,genericSubmits=0;
  const input=name=>{if(!fieldsByName.has(name)){const field=node();field.form=form;fieldsByName.set(name,field);}return fieldsByName.get(name);};
  for(const name of ['name','phone','email'])ids.set('contact-'+name,input(name));
  for(const id of ['contact-submit','contact-status','contact-form-error'])ids.set(id,node());
  ids.set('contact-message',input('message'));
  const sharedWrappers=['name','phone','email','message','submit'].map(name=>{
    const wrapper=node();wrapper.className=name==='submit'?'form-actions':'form-field';wrapper.appendChild(ids.get('contact-'+name));return wrapper;
  });
  const footer=node('p');footer.setAttribute('data-i18n','contact.footer');
  const formContainer=node();formContainer.appendChild(form);formContainer.appendChild(footer);sharedWrappers.push(footer);
  form.querySelector=selector=>selector==='[data-contact-event-special-editor]'?legacy:selector==='[data-contact-handoff="whatsapp"]'?whatsapp:selector.startsWith('#')?ids.get(selector.slice(1))||null:/\[name="([^"]+)"\]/.test(selector)?input(selector.match(/\[name="([^"]+)"\]/)[1]):null;
  const document=context.document,documentListeners=new Map();document.readyState='loading';document.querySelector=selector=>selector==='form[name="contact"]'?form:null;
  document.getElementById=id=>id==='contact'?{scrollIntoView(){navigations++;}}:ids.get(id)||null;
  document.createElement=tagName=>node(tagName);document.addEventListener=(type,fn)=>{const listeners=documentListeners.get(type)||[];listeners.push(fn);documentListeners.set(type,listeners);};window.document=document;window.CustomEvent=context.CustomEvent;
  document.body={contains:()=>true};
  // The external phone library boundary is synthetic; the shared validator is exercised unchanged.
  window.libphonenumber={parsePhoneNumberFromString:value=>({isValid:()=>value==='+525555555555',number:value})};
  const load=(file,transform=s=>s)=>vm.runInNewContext(transform(fs.readFileSync(path.join(ROOT,'assets/js',file),'utf8')),context,{filename:file});
  load('forms/reservation-request.js',s=>s.replace('  window.PixkuyForms.initReservationRequestForm = initReservationRequestForm;','  window.contactTest={bindSubmitValidation,validateReservationRequestFields};\n  window.PixkuyForms.initReservationRequestForm = initReservationRequestForm;'));
  load('forms/contact-service-state.js');
  load('airport-tariff/airport-tariff-dropdowns.js');
  load('forms/contact-event-special-editor.js',s=>s.replace('  NAMESPACE.initContactEventSpecialEditor = initContactEventSpecialEditor;','  window.nativeEventTest={state,selectGroup,getEventGroups,loadData};\n  NAMESPACE.initContactEventSpecialEditor = initContactEventSpecialEditor;'));
  load('forms/contact-event-package-context.js');
  const nativeHandoff=window.PixkuyForms.applyContactEventSpecialHandoff;
  window.PixkuyForms.applyContactEventSpecialHandoff=detail=>{v1Handoffs++;nativeHandoff(detail);};
  window.PixkuySubmissionGuard={prepareSubmit(){genericSubmits++;return true;}};
  load('forms/index.js',s=>s.replace("  if (document.readyState === 'loading') {","  window.bindPackageNavigationTest=bindEventsSpecialPanelHandoff;\n  if (document.readyState === 'loading') {"));
  window.bindPackageNavigationTest();window.bindPackageNavigationTest();
  window.PixkuyForms.contactServiceState.init();
  const fields=window.PixkuyForms.getReservationRequestFields(form);
  window.contactTest.bindSubmitValidation(fields);window.contactTest.bindSubmitValidation(fields);
  assert.equal(form.listeners.submit.length,1,'shared submit binds once');
  const candidate=JSON.parse(JSON.stringify(event));candidate.id='shared-contact-synthetic';
  const option=candidate.snapshot.packages[0].options[0];option.services[0].ordinary.inputs.flight={source:'customer'};
  option.services.push({...JSON.parse(JSON.stringify(option.services[0])),id:'return-service'});
  option.services[1].ordinary.inputs.direction.value='destination_to_airport';
  const venue={id:'synthetic-venue',active:true,name:'Synthetic venue'};
  const traditional={id:'synthetic-v1',eventGroupId:'synthetic-v1-group',active:true,title:'Synthetic V1',startsAt:'2027-10-30T19:00',startsAtUtc:'2027-10-31T01:00:00Z',venueId:venue.id,posterSrc:'/synthetic.webp',type:'festival',snapshotVersion:1,priority:1};
  window.PixkuyServicesEventsCatalogSource={loadCatalog:async()=>({events:[traditional],venues:[venue],pricing:{}})};
  controller.state.events=[candidate];controller.state.catalogStatus='ready';
  await window.PixkuyForms.initContactEventSpecialEditor();
  controller.selectEvent(candidate,false);controller.choose('welcome','arrival');controller.go('services');
  controller.change(s=>{s.passengerBand='van_3_4';s.services=option.services.map((service,i)=>({serviceId:service.id,ordinaryInputs:{destination:{address:'Synthetic hotel '+i,placeId:'synthetic-place-'+i},date:i?'2027-10-30':'2027-10-29',time:'09:00',...(i?{flight:'SYN123',baggageCount:0}:{})}}));});
  const calculation={calculationModel:'ordinary_services',coverageStatus:'verified',serviceCount:2,pendingCodes:[],conditions:[{title:{es:'Synthetic condition'},description:{es:'Full text retained'}}],priceBreakdown:{priceStatus:'quoted',pricedSubtotal:'25000',currency:'MXN',automaticAddOns:[]},serviceLines:[]};
  window.PixkuyEventPackagesApi.quote=async()=>({source:'published',quoteFingerprint:'e'.repeat(64),calculation});
  await controller.quote();
  const selectionBefore=JSON.stringify(controller.state.selection);
  window.PixkuyAirportTariffCatalog={resolveDisplayLabel:()=> 'Aeropuerto Internacional de la Ciudad de México'};
  const root={querySelectorAll:()=>[],getAttribute:()=> 'desktop'};
  assert.equal(window.PixkuyEventPackagesConfig.contactHandoff(root),true);
  const contact=window.PixkuyEventPackagesContact;
  assert.equal(navigations,1);assert.equal(contact.isActive(),true);assert.equal(legacy.hidden,false);assert.equal(whatsapp.hidden,true);
  assert.equal(window.PixkuyForms.getContactEventSelection().eventId,candidate.id);
  const picker=legacy.__contactEventPicker;
  assert.ok(picker&&picker.host.getAttribute('data-contact-event-picker')!==null,'one custom event selector is visible');
  assert.equal(legacy.querySelectorAll('[data-contact-event-picker]').length,1);
  assert.equal(legacy.querySelector('select'),null,'the visible event selector is not native');
  assert.equal(picker.control.getAttribute('aria-haspopup'),'listbox');
  assert.equal(picker.control.getAttribute('aria-expanded'),'false');
  assert.equal(picker.value.textContent,'Evento sintético');
  assert.equal(window.nativeEventTest.getEventGroups().some(group=>group.title==='Synthetic V1'),true);
  picker.control.dispatchEvent({type:'click'});assert.equal(picker.control.getAttribute('aria-expanded'),'true');
  assert.equal(picker.panel.querySelectorAll('.place-autocomplete__item-button').length,2);
  assert.equal(picker.panel.querySelectorAll('.place-autocomplete__item-button').filter(option=>option.getAttribute('aria-selected')==='true').length,1);
  picker.control.dispatchEvent({type:'keydown',key:'Escape',preventDefault(){}});assert.equal(picker.control.getAttribute('aria-expanded'),'false');
  picker.control.dispatchEvent({type:'click'});for(const listener of documentListeners.get('pointerdown')||[])listener({target:node()});assert.equal(picker.control.getAttribute('aria-expanded'),'false');
  picker.control.dispatchEvent({type:'click'});picker.control.dispatchEvent({type:'keydown',key:'Tab',preventDefault(){}});assert.equal(picker.control.getAttribute('aria-expanded'),'false');
  assert.equal(JSON.stringify(controller.state.selection),selectionBefore);
  assert.equal(v1Handoffs,0);assert.equal(genericSubmits,0);
  const beforeCategorySelection=JSON.stringify(controller.state.selection),beforeCategoryQuote=controller.state.quote;
  window.PixkuyForms.contactServiceState.setActiveServiceType('hourly_daily',{source:'synthetic-category-click'});
  assert.equal(contact.isActive(),false,'an inactive package never intercepts another category');
  window.PixkuyForms.contactServiceState.setActiveServiceType('event_special',{source:'synthetic-category-click'});
  assert.equal(contact.isActive(),true,'REGRESSION: package → private driver → Upcoming Events restores native package selection');
  assert.equal(JSON.stringify(controller.state.selection),beforeCategorySelection);
  assert.equal(controller.state.quote,beforeCategoryQuote);
  calculation.serviceLines=[{included:{quoteExpiresAt:'2000-01-01T00:00:00Z'}}];
  assert.equal(contact.canSubmit(),false,'an expired canonical quote blocks submission');
  assert.equal(window.PixkuyEventPackagesConfig.contactHandoff(root),false,'an expired quote blocks navigation');
  calculation.serviceLines=[];
  const markup=node=>node.innerHTML+node.children.map(markup).join('');
  const html=markup(legacy.sibling);
  for(const text of ['Synthetic hotel 0','Synthetic hotel 1','Aeropuerto Internacional','29 de octubre de 2027','30 de octubre de 2027','3–4','250.00 MXN','Full text retained','SYN123'])assert.ok(html.includes(text),text);
  assert.ok(!html.includes('2027-10-29'));assert.ok(!html.includes('synthetic-place-'));assert.ok(!html.includes('<form'));assert.ok(!html.includes('Hay datos o condiciones pendientes'));
  calculation.pendingCodes=['REAL_ECONOMIC_PENDING'];controller.notify();assert.ok(markup(legacy.sibling).includes('Hay datos o condiciones pendientes'));calculation.pendingCodes=[];
  assert.equal(window.contactTest.validateReservationRequestFields(fields).email,false);
  input('phone').value=' +52 (555) 555-5555 ';
  assert.equal(window.PixkuyForms.refreshReservationRequestValidationUX(fields,'phone'),true,'the public desktop validator accepts its canonical telephone');
  assert.equal(window.PixkuyForms.getReservationRequestData(fields).phone,'+525555555555','the public desktop data API returns its normalized telephone');
  input('phone').value='+520000000000';
  assert.equal(window.PixkuyForms.refreshReservationRequestValidationUX(fields,'phone'),false,'the public desktop validator rejects an invalid telephone');
  const mobileForm=node('form'),mobileRoot=node('section');
  mobileForm.setAttribute('data-package-mobile-contact-form','');mobileRoot.appendChild(mobileForm);
  const mobileContact=(name,value,errorText)=>{
    const wrapper=node('div'),field=node('input'),error=node('p');
    wrapper.className='form-field';field.form=mobileForm;field.value=value;
    field.setAttribute('name',name);field.setAttribute('data-package-field','contact:'+name);
    if(name==='phone')field.setAttribute('data-package-canonical-phone','');
    error.setAttribute('data-error-for',name);error.setAttribute('data-i18n',name==='phone'?'airportMobileContactStep.validation.phone':'contact.validation.'+name+'Required');
    error.textContent=errorText;error.hidden=true;wrapper.appendChild(field);wrapper.appendChild(error);mobileForm.appendChild(wrapper);
    return {field,error};
  };
  const mobileName=mobileContact('name','Synthetic Person','Indica tu nombre completo.');
  const mobilePhone=mobileContact('phone',' +52 (555) 555-5555 ','Indica un teléfono válido con formato internacional.');
  const mobileEmail=mobileContact('email','synthetic@example.invalid','Indica un email válido.');
  input('service_type').value='event_special';
  const mobileFields=window.packageTestHooks.mobileContactValidationFields(mobileRoot);
  assert.equal(mobileFields.name,mobileName.field);assert.equal(mobileFields.phone,mobilePhone.field);assert.equal(mobileFields.email,mobileEmail.field);
  assert.equal(mobileFields.tripDate,input('trip_date'),'the adapter reuses the real canonical service field instead of fabricating one');
  const submitsBeforeMobileValidation=runtime.calls.filter(call=>call.kind==='submit').length;
  assert.equal(window.packageTestHooks.validateMobilePackageContact(mobileRoot),true,'the same canonical valid telephone accepted on desktop passes Events mobile');
  assert.equal(mobilePhone.field.value,'+525555555555');assert.equal(controller.state.contact.phone,'+525555555555');
  assert.equal(mobilePhone.field.getAttribute('aria-invalid'),'false');assert.equal(mobilePhone.error.hidden,true);
  mobilePhone.field.value='+520000000000';controller.state.contact.phone=mobilePhone.field.value;
  assert.equal(window.packageTestHooks.validateMobilePackageContact(mobileRoot,'phone'),false,'the same canonical invalid telephone rejected on desktop fails Events mobile');
  assert.equal(mobilePhone.field.getAttribute('aria-invalid'),'true');assert.equal(mobilePhone.error.hidden,false);
  assert.equal(mobilePhone.error.textContent,'Indica un teléfono válido con formato internacional.');assert.equal(mobilePhone.field.focused,true);
  mobilePhone.field.value=' +52 (555) 555-5555 ';controller.state.contact.phone=mobilePhone.field.value;
  assert.equal(window.packageTestHooks.validateMobilePackageContact(mobileRoot,'phone'),true,'correcting the telephone immediately restores the Events mobile gate');
  assert.equal(mobilePhone.field.value,'+525555555555');assert.equal(mobilePhone.error.hidden,true);
  assert.equal(runtime.calls.filter(call=>call.kind==='submit').length,submitsBeforeMobileValidation,'validation never emits a package request');
  input('name').value='Synthetic Person';input('phone').value='+525555555555';input('email').value='synthetic@example.invalid';form.dispatchEvent({type:'input'});
  assert.equal(window.PixkuyForms.hasMinimumRequiredReservationData(window.PixkuyForms.getReservationRequestData(fields)),true);
  const email=input('email');email.value='invalid';assert.equal(window.contactTest.validateReservationRequestFields(fields).email,false);email.value='synthetic@example.invalid';
  const inputIdentity=input('name');window.PixkuyEventPackagesConfig.editServices();
  assert.equal(controller.state.step,'services');assert.equal(contact.canSubmit(),false);assert.equal(input('name'),inputIdentity);assert.equal(input('name').value,'Synthetic Person');
  controller.change(s=>{s.services[1].ordinaryInputs.baggageCount=3;});assert.equal(controller.state.quote,null);
  let prevented=0;const submit=()=>form.dispatchEvent({type:'submit',preventDefault(){prevented++;}});
  submit();assert.equal(genericSubmits,0);assert.equal(contact.canSubmit(),false);
  await controller.quote();assert.equal(window.PixkuyEventPackagesConfig.contactHandoff(root),true);assert.equal(navigations,2);
  assert.equal(input('email').value,'synthetic@example.invalid');assert.equal(controller.state.selection.services[1].ordinaryInputs.baggageCount,3);
  assert.equal(controller.state.selection.services[0].ordinaryInputs.baggageCount,undefined);
  // V1 and the other form consumers retain their own route and guards.
  window.dispatchEvent(new context.CustomEvent('pixkuy:events-special-panel-submit',{detail:{event_special_event_id:'synthetic-v1'}}));
  assert.equal(v1Handoffs,1);assert.equal(contact.isActive(),false);assert.equal(legacy.hidden,false);assert.equal(whatsapp.hidden,false);
  const v1={name:'Synthetic',phone:'+525555555555',email:'synthetic@example.invalid',serviceType:'event_special',eventSpecialEventId:'synthetic-v1',eventSpecialVariant:'arrival',eventSpecialPassengerFareKey:'van_1_2',eventSpecialPrice:'500',eventSpecialCurrency:'MXN',eventSpecialOriginAddress:'Synthetic address',eventSpecialOriginPlaceId:'synthetic-place',eventSpecialOriginPickupTime:'09:00'};
  assert.equal(window.PixkuyForms.hasMinimumRequiredReservationData(v1),true);delete v1.eventSpecialOriginPlaceId;assert.equal(window.PixkuyForms.hasMinimumRequiredReservationData(v1),false);
  const direct={name:'Synthetic',phone:'+525555555555',email:'synthetic@example.invalid',serviceType:'direct_transfer',directTransferOriginAddress:'Synthetic origin',directTransferOriginPlaceId:'synthetic-origin',directTransferDestinationAddress:'Synthetic destination',directTransferDestinationPlaceId:'synthetic-destination',directTransferDate:'2027-10-29',directTransferTime:'09:00',directTransferPassengerFareKey:'van_1_2',directTransferPrice:'500',directTransferCurrency:'MXN'};
  assert.equal(window.PixkuyForms.hasMinimumRequiredReservationData(direct),true);delete direct.directTransferOriginPlaceId;assert.equal(window.PixkuyForms.hasMinimumRequiredReservationData(direct),false);
  // The real shared submit listener must dispatch inactive packages to the
  // existing service guard. No transport or business request is invoked here.
  const routed=[];
  window.PixkuySubmissionGuard.prepareSubmit=(_form,serviceType)=>{routed.push(serviceType);return true;};
  const nativeRoutes={
    event_special:{event_special_event_id:'synthetic-v1',event_special_variant:'arrival',event_special_passenger_fare_key:'van_1_2',event_special_price:'500',event_special_currency:'MXN',event_special_origin_address:'Synthetic address',event_special_origin_address_place_id:'synthetic-place',event_special_origin_pickup_time:'09:00'},
    hourly_daily:{hourly_daily_mode:'hourly',hourly_daily_pickup:'Synthetic pickup',hourly_daily_date:'2027-10-29',hourly_daily_start_time:'09:00',hourly_daily_duration_hours:'4',hourly_daily_price:'500',hourly_daily_currency:'MXN'},
    direct_transfer:{direct_transfer_origin_address:'Synthetic origin',direct_transfer_origin_place_id:'synthetic-origin',direct_transfer_destination_address:'Synthetic destination',direct_transfer_destination_place_id:'synthetic-destination',direct_transfer_date:'2027-10-29',direct_transfer_time:'09:00',direct_transfer_passenger_fare_key:'van_1_2',direct_transfer_price:'500',direct_transfer_currency:'MXN'}
  };
  for(const [category,values] of Object.entries(nativeRoutes)){
    window.PixkuyForms.contactServiceState.setActiveServiceType(category);
    for(const [name,value] of Object.entries(values))input(name).value=value;
    assert.equal(contact.isActive(),false);
    submit();assert.equal(routed.at(-1),category,'the shared listener retains dispatch for '+category);
  }
  assert.deepEqual(routed,['event_special','hourly_daily','direct_transfer']);
  window.PixkuySubmissionGuard.prepareSubmit=()=>{genericSubmits++;return true;};
  window.PixkuyForms.contactServiceState.setActiveServiceType('event_special');
  const selectNative=id=>{
    picker.control.dispatchEvent({type:'click'});
    const options=picker.panel.querySelectorAll('.place-autocomplete__item-button');
    const index=options.findIndex(option=>option.dataset.airportTariffOptionValue===id);
    assert.ok(index>=0,'event remains in the canonical picker');
    picker.control.dispatchEvent({type:'keydown',key:'Home',preventDefault(){}});
    for(let step=0;step<index;step++)picker.control.dispatchEvent({type:'keydown',key:'ArrowDown',preventDefault(){}});
    picker.control.dispatchEvent({type:'keydown',key:'Enter',preventDefault(){}});
  };
  const selectByClick=id=>{
    picker.control.dispatchEvent({type:'click'});
    const option=picker.panel.querySelectorAll('.place-autocomplete__item-button').find(item=>item.dataset.airportTariffOptionValue===id);
    assert.ok(option,'event remains available for pointer selection');
    picker.panel.dispatchEvent({type:'click',target:option});
  };
  selectNative(candidate.id);
  assert.equal(window.PixkuyForms.getContactEventSelection().eventId,candidate.id);
  input('message').value='Synthetic shared notes';
  const serviceState=window.PixkuyForms.contactServiceState;
  let destructiveResets=0;
  serviceState.registerSpecificDraftProbe('hourly_daily',()=>true);
  serviceState.registerSpecificReset('hourly_daily',()=>{destructiveResets++;});
  const retained=JSON.stringify(controller.state.selection),retainedQuote=controller.state.quote;
  const listenerCount=form.listeners['pixkuy:contact-service-change'].length;
  for(let i=0;i<5;i++){
    serviceState.setActiveServiceType('hourly_daily');assert.equal(contact.isActive(),false);
    assert.equal(legacy.sibling.hidden,true);
    serviceState.setActiveServiceType('event_special');assert.equal(contact.isActive(),true);
    assert.equal(window.PixkuyForms.getContactEventSelection().eventId,candidate.id);
    assert.equal(JSON.stringify(controller.state.selection),retained);assert.equal(controller.state.quote,retainedQuote);
    assert.equal(input('message').value,'Synthetic shared notes');assert.equal(input('name').value,'Synthetic Person');
  }
  assert.equal(destructiveResets,0,'switching category does not reset any service draft');
  assert.equal(form.listeners['pixkuy:contact-service-change'].length,listenerCount);
  serviceState.setActiveServiceType('hourly_daily');controller.state.configurationSurface='upper';controller.go('services');
  assert.equal(window.PixkuyEventPackagesConfig.contactHandoff(root),true,'upper re-entry after switching category preserves a valid quote');
  assert.equal(controller.state.quote,retainedQuote);assert.equal(controller.state.screen,'contact');assert.equal(contact.canSubmit(),true);
  // A delayed quote belongs to the suspended package, never to the new category.
  let finishOld;window.PixkuyEventPackagesApi.quote=()=>new Promise(resolve=>{finishOld=resolve;});
  controller.go('services');const oldQuote=controller.quote();serviceState.setActiveServiceType('hourly_daily');
  finishOld({source:'published',quoteFingerprint:'0'.repeat(64),calculation});await oldQuote;
  assert.equal(controller.state.quote,null);assert.equal(contact.isActive(),false);
  window.PixkuyEventPackagesApi.quote=async()=>({source:'published',quoteFingerprint:'e'.repeat(64),calculation});
  serviceState.setActiveServiceType('event_special');window.packageTestHooks.cancelAirportAutoQuote();await controller.quote();
  // Both sources feed the same native selector, and direct entry mounts the actual config renderer.
  const directEntry=JSON.parse(JSON.stringify(candidate));directEntry.id='native-direct-package';directEntry.snapshot.translations.es.title='QA LOCAL · Native package';directEntry.snapshot.packages[0].options[0].services=directEntry.snapshot.packages[0].options[0].services.slice(0,1);
  let catalogRequests=0;
  window.PixkuyEventPackagesApi.load=async()=>{catalogRequests++;return {events:[candidate,directEntry]};};
  await Promise.all([window.PixkuyEventPackagesConfig.load(),window.PixkuyEventPackagesConfig.load()]);assert.equal(catalogRequests,1,'catalog loads are coalesced');
  selectByClick(directEntry.id);assert.equal(controller.state.selection.eventId,directEntry.id);assert.equal(controller.state.selection.services.length,0);assert.equal(controller.state.quote,null);
  assert.equal(picker.value.textContent,'QA LOCAL · Native package');assert.ok(markup(legacy.sibling).includes('data-package-configure="welcome"'));
  const embeddedRoot=legacy.sibling.children[0].children[0];assert.equal(embeddedRoot.getAttribute('data-event-package-root'),'contact');
  await window.packageTestHooks.handleClick(embeddedRoot,{target:{closest:()=>({disabled:false,getAttribute:name=>name==='data-package-configure'?'welcome':null})}});
  assert.equal(controller.state.step,'services');assert.ok(markup(legacy.sibling).includes('events-package-airport__form'));
  let automaticQuotes=0;
  window.PixkuyEventPackagesApi.quote=async()=>{automaticQuotes++;return {source:'published',quoteFingerprint:'f'.repeat(64),calculation:{...calculation,serviceCount:1}};};
  controller.change(s=>{s.passengerBand='van_1_2';s.services=[{serviceId:'arrival-service',ordinaryInputs:{destination:{address:'Direct entry synthetic hotel',placeId:'synthetic-direct-place'},date:'2026-10-29',time:'09:00',baggageCount:0}}];});
  await new Promise(resolve=>setTimeout(resolve,360));assert.equal(automaticQuotes,1);assert.equal(controller.state.quoteStatus,'ready');
  await window.packageTestHooks.handleClick(embeddedRoot,{target:{closest:()=>({disabled:false,getAttribute:name=>name==='data-package-action'?'airport-review':null})}});
  assert.equal(controller.state.screen,'contact');assert.equal(contact.canSubmit(),true);assert.equal(controller.state.selection.services[0].ordinaryInputs.baggageCount,0);
  // Removal must keep the unavailable identity and fail closed, never choose the first V1 event.
  window.PixkuyEventPackagesApi.load=async()=>({events:[candidate]});await window.PixkuyEventPackagesConfig.load();
  assert.equal(window.PixkuyForms.getContactEventSelection().eventId,directEntry.id);assert.equal(window.PixkuyForms.getContactEventSelection().available,false);assert.equal(contact.canSubmit(),false);assert.equal(controller.state.quote,null);
  assert.ok(markup(legacy).includes(window.PixkuyEventPackagesConfig.t('eventUnavailable')));
  selectNative('synthetic-v1-group');assert.equal(contact.isActive(),false);assert.equal(legacy.sibling.hidden,true);
  assert.equal(legacy.__contactEventPicker,picker,'the selector surface persists when the V1 body replaces the package body');
  assert.equal(picker.value.textContent,'Synthetic V1');assert.ok(markup(legacy).includes('contact-event-special-editor__layout'));
  assert.ok(!markup(legacy).includes('Direct entry synthetic hotel'));
  window.nativeEventTest.state.originAddress='Retained V1 address';window.nativeEventTest.state.originPlaceId='retained-v1-place';
  window.nativeEventTest.state.originPickupTime='08:45';window.nativeEventTest.state.quoteStatus='ready';window.nativeEventTest.state.quote={price:500,currency:'MXN'};
  selectNative('synthetic-v1-group');assert.equal(window.nativeEventTest.state.originPlaceId,'retained-v1-place','reselecting the active V1 event is a no-op');
  selectNative(candidate.id);assert.equal(controller.state.selection.eventId,candidate.id);assert.equal(controller.state.selection.services.length,2);assert.equal(controller.state.quote,null);
  assert.equal(legacy.__contactEventPicker,picker,'the same selector surface persists when returning to packages');
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,'synthetic-place-0');assert.equal(input('message').value,'Synthetic shared notes');
  selectNative('synthetic-v1-group');assert.equal(window.nativeEventTest.state.originPlaceId,'retained-v1-place');assert.equal(window.nativeEventTest.state.originPickupTime,'08:45');assert.equal(window.nativeEventTest.state.quote.price,500);
  selectNative(candidate.id);assert.equal(controller.state.selection.services.length,2);assert.equal(documentListeners.get('pointerdown').length,1,'the persistent picker binds outside-click once');
  window.PixkuyEventPackagesApi.quote=async()=>({source:'published',quoteFingerprint:'e'.repeat(64),calculation});await controller.quote();
  console.log(JSON.stringify({suite:'native-upcoming-event-packages',status:'PASS',cases:['upper-entry-native-identity','one-persistent-custom-picker','keyboard-escape-tab-outside','pointer-selection','exact-reported-category-cycle','five-cycles-no-listener-growth','shared-contact-and-notes','other-service-draft-preserved','v1-draft-preserved','late-category-quote-rejected','single-source-load-coalesced','direct-selector-entry-reuses-config','native-one-service-autoquote','multi-service-draft-restored','zero-versus-absent-baggage','unavailable-event-no-silent-substitution','explicit-v1-v2-isolation'],externalCalls:0,databaseWrites:0,visualAcceptance:false}));
  assert.equal(window.PixkuyEventPackagesConfig.contactHandoff(root),true);
  // Exercise the actual API adapter against an in-memory transport: no request leaves the runner.
  window.PIXKUY_BOOKING_API_CONFIG={apiBaseUrl:'http://synthetic.invalid',publicSiteKey:'synthetic-site'};
  const posts=[];let complete;window.fetch=async(url,options)=>{posts.push({url,options});return new Promise(resolve=>{complete=()=>resolve({ok:true,json:async()=>({receipt:runtime.receipt})});});};
  load('services/events-package-catalog.js');
  Object.assign(runtime.receipt,{eventId:candidate.id,requestKind:'package',packageTitle:'Accepted package',optionTitle:'Accepted option',passengerBand:'van_3_4',passengerSource:'band',priceStatus:'quoted',pricedSubtotal:'25000',currency:'MXN',pendingCodes:[],confirmation:{
    eventTitle:{es:'Accepted event',en:'Accepted event EN'},packageTitle:{es:'Accepted package'},optionTitle:{es:'Accepted option'},
    services:[{kind:'trip',baseService:'airport_transfer',direction:'airport_to_destination',startsAtUtc:'2027-10-30T01:30:00Z',endsAtUtc:'2027-10-30T01:30:00Z'}],
    conditions:[{title:{es:'Accepted condition'},description:{es:'Accepted full text <safe>'}}]
  }});
  submit();submit();await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(posts.length,1);assert.equal(posts[0].url,'http://synthetic.invalid/v1/public/special-event-package-requests');assert.equal(genericSubmits,0);assert.ok(prevented>=3);
  const body=JSON.parse(posts[0].options.body);assert.equal(body.services.length,2);assert.equal(body.passengerBand,'van_3_4');assert.equal(body.passengerCount,undefined);assert.equal(body.contact.email,'synthetic@example.invalid');assert.equal(body.services[1].ordinaryInputs.flight,'SYN123');assert.equal(body.services[1].ordinaryInputs.baggageCount,3);assert.equal(body.services[0].ordinaryInputs.baggageCount,undefined);assert.equal(body.acceptedQuoteFingerprint,'e'.repeat(64));
  complete();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(controller.state.requestStatus,'received');assert.equal(contact.canSubmit(),false);assert.ok(markup(legacy.sibling).includes(runtime.receipt.reference));submit();assert.equal(posts.length,1);
  assert.equal(runtime.request.hasFrozenBody(),false,'receipt notification sees the released retry body');
  for(const wrapper of sharedWrappers)assert.equal(wrapper.getAttribute('data-package-confirmed-field'),'','only this confirmation hides shared controls');
  assert.ok(!ids.get('contact-submit').textContent.includes('Reintentar'));
  const confirmation=markup(legacy.sibling);
  assert.equal(confirmationFocus.length,2,'focus and viewport move exactly once on success');
  assert.equal(confirmationFocus[0].options.preventScroll,true);assert.equal(confirmationFocus[1].options.block,'start');
  assert.ok(confirmation.indexOf('copy-reference')<confirmation.indexOf('<dl'),'reference precedes compact summary');
  assert.ok(confirmation.includes('No necesita enviarla de nuevo.'));
  assert.ok(confirmation.includes('Esta solicitud no constituye una reserva confirmada.'));
  assert.ok(!confirmation.includes('confirmar la disponibilidad'));
  assert.ok(!confirmation.includes('Servicios 1 ·'));
  assert.ok(!confirmation.includes('data-package-confirmation tabindex'),'focus belongs to heading, not receipt container');
  for(const text of ['Solicitud recibida correctamente','Accepted event','Accepted package','Accepted option','250.00 MXN','29 de octubre de 2027','19:30','CDMX','3–4','Accepted full text &lt;safe&gt;','data-package-action="copy-reference"','data-package-action="new"','data-package-confirmation-title','role="status"'])assert.ok(confirmation.includes(text),text);
  for(const text of ['Base:','Multiplicador','acceptedQuoteFingerprint','PUBLICATION','synthetic-place','data-package-action="retry"'])assert.ok(!confirmation.includes(text),text);
  assert.ok(!confirmation.includes('Cantidad no declarada'),'absent baggage is not a pending field');
  const savedConfirmation=confirmation;
  for(const language of ['es','en','de','fr','it','pt','ru','ko','zh-hans']){
    const dictionary=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/i18n',language,'services-events.json'),'utf8')).eventPackages;
    const previous=window.__pixkuyI18nDict.eventPackages;window.__pixkuyI18nDict.eventPackages=dictionary;
    const translated=window.PixkuyEventPackagesConfig.receiptContent(controller.state);
    for(const key of ['confirmationTitle','confirmationNext','confirmationNoRepeat','confirmationReservation','receiptEvent','receiptReference','copyReference','confirmationWhatsapp','confirmationNew'])assert.ok(translated.includes(dictionary[key]),language+': '+key);
    assert.ok(!translated.includes('undefined'));window.__pixkuyI18nDict.eventPackages=previous;
  }
  candidate.snapshot.translations.es.title='Changed catalog title';controller.notify();
  assert.equal(confirmationFocus.length,2,'unchanged receipt notifications do not steal focus');
  assert.equal(markup(legacy.sibling),savedConfirmation,'confirmation uses accepted receipt, not current catalog');
  serviceState.setActiveServiceType('hourly_daily');
  for(const wrapper of sharedWrappers)assert.equal(wrapper.getAttribute('data-package-confirmed-field'),null);
  assert.equal(input('name').readOnly,false);
  serviceState.setActiveServiceType('event_special');
  for(const wrapper of sharedWrappers)assert.equal(wrapper.getAttribute('data-package-confirmed-field'),'');
  assert.equal(posts.length,1,'returning to receipt does not submit');
  assert.equal(window.nativeEventTest.selectGroup('synthetic-v1-group'),true);
  assert.equal(contact.isActive(),false);
  for(const wrapper of sharedWrappers)assert.equal(wrapper.getAttribute('data-package-confirmed-field'),null);
  assert.equal(window.nativeEventTest.selectGroup(candidate.id),true);
  assert.equal(contact.isActive(),true);assert.ok(markup(legacy.sibling).includes(runtime.receipt.reference));
  const copied=[];window.navigator={clipboard:{writeText:async value=>copied.push(value)}};
  const copyStatus=node(),copyButton={closest:()=>({querySelector:()=>copyStatus})};
  await window.PixkuyEventPackagesConfig.copyReference(copyButton,runtime.receipt);assert.deepEqual(copied,[runtime.receipt.reference]);assert.equal(copyStatus.textContent,'Referencia copiada.');
  window.navigator.clipboard.writeText=async()=>{throw Error('synthetic clipboard denial');};
  await window.PixkuyEventPackagesConfig.copyReference(copyButton,runtime.receipt);assert.ok(copyStatus.textContent.includes('manualmente'));
  const action=node('button');action.setAttribute('data-package-action','new');
  legacy.sibling.dispatchEvent({type:'click',target:action});
  assert.equal(controller.state.receipt,null);assert.equal(controller.state.requestStatus,'idle');assert.equal(controller.state.selection.eventId,candidate.id);
  assert.equal(controller.state.selection.services.length,0,'new request does not revive sent itinerary');
  for(const wrapper of sharedWrappers)assert.equal(wrapper.getAttribute('data-package-confirmed-field'),null);
  assert.equal(input('message').value,'Synthetic shared notes','new request preserves shared drafts');
  // Run the real native Netlify preparation guard after leaving the package.
  window.nativeEventTest.selectGroup('synthetic-v1-group');
  for(const [name,value] of Object.entries(nativeRoutes.event_special))input(name).value=value;
  document.body.getAttribute=()=>null;
  form.querySelectorAll=selector=>selector.startsWith('[name="')?[input(selector.match(/\[name="([^"]+)"\]/)[1])]:selector.startsWith('button[type="submit"]')?[ids.get('contact-submit')]:[];
  load('forms/submission-guard.js');
  const preventedBeforeNative=prevented;submit();
  assert.equal(prevented,preventedBeforeNative,'valid V1 submit is not intercepted: native POST proceeds');
  assert.equal(form.dataset.submitted,'1','real submission guard prepared the native lead');
  assert.ok(input('submission_id').value);assert.equal(posts.length,1,'V1 does not use the package endpoint');
  const formHtml=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  assert.match(formHtml,/<form\s+class="form"\s+name="contact"\s+method="post"\s+data-netlify="true"[\s\S]*?action="\/\?lead=ok#contact"/);
  console.log(JSON.stringify({suite:'package-confirmation',status:'PASS',cases:['closed-success','released-frozen-body-before-notify','no-retry','snapshot-only','cdmx','optional-absence','copy-reference-success-and-denial','category-return','v1-return','new-deliberate-attempt'],externalCalls:0,visualAcceptance:false}));
  console.log(JSON.stringify({suite:'shared-package-contact',status:'PASS',cases:['canonical-handoff-once','shared-contact-validation','mobile-contact-real-fields','canonical-phone-parity','invalid-phone-no-submit','corrected-phone-recovers','all-services-and-places','human-cdmx-dates-airports','band-and-baggage-absence-zero-positive','edit-with-contact-preserved','stale-quote-blocked','real-package-api-route','concurrent-submit-once','receipt','economic-versus-optional','v1-route-and-validator-preserved'],externalCalls:0,databaseWrites:0,visualAcceptance:false}));
}
async function assertAirportDesktop(runtime,event,hooks,root) {
  const {window,controller}=runtime;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const candidate=copy(event);candidate.id='synthetic-desktop-airport';
  candidate.snapshot.servicePeriod={from:'2026-10-29T06:00:00Z',until:'2026-11-02T06:00:00Z'};
  candidate.snapshot.days=[{id:'day',title:{es:'Editorial day'},date:'2026-10-29'}];
  candidate.snapshot.conditions=[{title:{es:'Repeated condition'},description:{es:'Full condition text'}},{title:{es:'Repeated condition'},description:{es:'Full condition text'}}];
  const service=candidate.snapshot.packages[0].options[0].services[0];
  service.dayId='day';
  service.ordinary.inputs.airportId={source:'customer'};
  service.ordinary.inputs.flight={source:'customer'};
  service.ordinary.restrictions={airportIds:['mex','nlu'],fromDate:'2026-10-29',untilDate:'2026-10-31'};
  const labels=lang=>JSON.parse(fs.readFileSync(path.join(ROOT,'assets/i18n',lang,'services-events.json'),'utf8')).eventPackages;
  window.__pixkuyI18nDict.eventPackages=labels('es');
  let mobile=false;window.matchMedia=()=>({matches:mobile});
  controller.selectEvent(candidate,false);controller.choose('welcome','arrival');
  const desktopStepOne=hooks.configuration(controller.state,'desktop');
  const mobileStepOne=hooks.configuration(controller.state,'mobile');
  assert.ok(desktopStepOne.includes('events-package-offer__disclosure'),'desktop retains the approved disclosure');
  assert.ok(desktopStepOne.includes('data-package-action="ordinary-custom"'),'desktop retains the header custom entry');
  assert.ok(mobileStepOne.includes('data-package-action="details"'),'mobile opens details in its auxiliary window');
  assert.ok(!mobileStepOne.includes('events-package-offer__disclosure'),'mobile does not expand offer details inline');
  assert.ok(!mobileStepOne.slice(0,mobileStepOne.indexOf('</header>')).includes('data-package-action="ordinary-custom"'),'mobile header has no duplicate custom entry');
  controller.go('services');
  const render=()=>hooks.configuration(controller.state,'desktop');
  function assertSameControls(desktopHtml,mobileHtml,message,compareActions=true){
    const headerEnd=html=>html.indexOf('</header>')+'</header>'.length;
    const mobileHeader=mobileHtml.slice(0,headerEnd(mobileHtml));
    assert.ok(mobileHeader.includes('events-package-event-heading__meta'),'mobile keeps compact event context');
    for(const text of ['Evento sintético','Recinto sintético','30 oct – 1 nov 2026'])assert.ok(mobileHeader.includes(text),'mobile header preserves '+text);
    assert.ok(!desktopHtml.slice(0,headerEnd(desktopHtml)).includes('events-package-event-heading__meta'),'generic desktop header remains unchanged');
    // Mobile now has a different layout and a closed date choice, but consumes
    // the same business fields, constraints, values and calculation actions.
    const controls=html=>[...html.matchAll(/<(input|select|textarea)\b[^>]*data-package-field="[^"]+"[^>]*>(?:[^]*?<\/\1>)?/g)].map(match=>match[0]).filter(markup=>!markup.includes(':ordinary-date"')).map(markup=>markup.replace(/ class="[^"]*"/g,'').replace(/ data-package-mobile-(?:lodging|address)-input/g,'').replace(/ data-package-mobile-address-title="[^"]*"/g,'').replace(/ aria-describedby="[^"]*"/g,'').replace(/ data-package-description="[^"]*"/g,'')).sort();
    assert.deepEqual(controls(desktopHtml),controls(mobileHtml),message);
    const dateContract=html=>{const tag=html.match(/<(?:input|select)[^>]*data-package-field="[^"]+:ordinary-date"[^>]*>/)?.[0]||'';return {field:tag.match(/data-package-field="([^"]+)"/)?.[1]||'',min:tag.match(/(?:data-)?min="([^"]+)"/)?.[1]||'',max:tag.match(/(?:data-)?max="([^"]+)"/)?.[1]||''};};
    assert.deepEqual(dateContract(desktopHtml),dateContract(mobileHtml),message+' date contract');
    const actions=html=>[...html.matchAll(/<button[^>]*data-package-action="([^"]+)"[^>]*>/g)].filter(match=>match[1]!=='details').map(match=>[match[1],match[0].includes(' disabled')]).sort();
    if(compareActions)assert.deepEqual(actions(desktopHtml.slice(headerEnd(desktopHtml))),actions(mobileHtml.slice(headerEnd(mobileHtml))),message);
  }
  const initial=render();
  assert.ok(initial.includes('Configure su traslado'));
  assert.ok(initial.includes('Welcome · Llegada'));
  assert.ok(initial.includes('data-package-step="services" aria-current="step"'));
  assert.ok(!initial.includes('events-package-service-disclosure'));
  assert.ok(!initial.includes('Editorial day'));
  assert.ok(!initial.includes('events-package-ordinary__direction'));
  assert.ok(initial.includes('Falta:'));
  assert.equal(initial.split('Fecha y hora locales de Ciudad de México').length-1,1);
  assert.ok(initial.indexOf('events-package-airport__route')<initial.indexOf('events-package-airport__schedule'));
  assert.ok(initial.indexOf('events-package-airport__schedule')<initial.indexOf('events-package-airport__extras'));
  assert.ok(initial.indexOf('events-package-airport__extras')<initial.indexOf('Full condition text'));
  assert.equal(initial.split('Full condition text').length-1,2,'no condition deduplication');
  assert.ok(initial.includes('min="2026-10-29"'));assert.ok(initial.includes('max="2026-10-31"'));
  const dateTag=initial.match(/<input[^>]*data-package-field="service:arrival-service:ordinary-date"[^>]*>/)[0];
  assert.ok(dateTag.includes('value=""'),'editorial day does not populate customer date');
  const savedPeriod=copy(candidate.snapshot.servicePeriod),savedRestrictions=copy(service.ordinary.restrictions),savedSelection=copy(controller.state.selection);
  candidate.snapshot.servicePeriod={from:'2026-10-23T06:00:00Z',until:'2026-11-03T06:00:00Z'};
  service.ordinary.restrictions={airportIds:['mex','nlu']};
  const expandedBounds=hooks.serviceBounds(service);
  assert.equal(expandedBounds.minDate,'2026-10-23');assert.equal(expandedBounds.maxDate,'2026-11-02');assert.equal(expandedBounds.min,'2026-10-23T00:00');assert.equal(expandedBounds.max,'2026-11-02T23:59');
  controller.state.selection.passengerBand='van_1_2';
  controller.state.selection.services=[{serviceId:'arrival-service',ordinaryInputs:{airportId:'mex',destination:{address:'Synthetic date boundary',placeId:'synthetic-date-place'},date:'2026-10-23',time:'09:00',flight:'SYN-DATE',baggageCount:1}}];
  const dateView={option:candidate.snapshot.packages[0].options[0],service,arrival:true};
  assert.equal(hooks.airportQuoteReadiness(controller.state,dateView).ready,true,'the inclusive lower boundary is quoteable');
  controller.state.selection.services[0].ordinaryInputs.date='2026-10-22';
  assert.ok(hooks.airportQuoteReadiness(controller.state,dateView).invalid.includes(labels('es').transferDate),'the day before the published service period is rejected');
  candidate.snapshot.servicePeriod=savedPeriod;service.ordinary.restrictions=savedRestrictions;controller.state.selection=savedSelection;
  const optionalState=copy(controller.state);const optionalView={option:candidate.snapshot.packages[0].options[0],service,arrival:true};
  optionalState.selection.passengerBand='van_1_2';optionalState.selection.services=[{serviceId:'arrival-service',ordinaryInputs:{airportId:'mex',destination:{address:'Synthetic optional destination',placeId:'synthetic-optional-place'},date:'2026-10-29',time:'09:00'}}];
  assert.equal(hooks.airportQuoteReadiness(optionalState,optionalView).ready,true,'flight and baggage may both remain unanswered');
  optionalState.selection.services[0].ordinaryInputs.flight='SYN123';assert.equal(hooks.airportQuoteReadiness(optionalState,optionalView).ready,true,'a supplied flight remains valid');
  delete optionalState.selection.services[0].ordinaryInputs.flight;optionalState.selection.services[0].ordinaryInputs.baggageCount=0;assert.equal(hooks.airportQuoteReadiness(optionalState,optionalView).ready,true,'zero bags is a declared value');
  optionalState.selection.services[0].ordinaryInputs.baggageCount=3;assert.equal(hooks.airportQuoteReadiness(optionalState,optionalView).ready,true,'a positive baggage count remains valid');
  optionalState.selection.services[0].ordinaryInputs.baggageCount=-1;assert.ok(hooks.airportQuoteReadiness(optionalState,optionalView).invalid.includes(labels('es').baggageCount),'an invalid baggage count is rejected');
  const requiredState=copy(optionalState);requiredState.selectedEvent.snapshot.packages[0].options[0].baggagePolicy={allowUnknown:false};delete requiredState.selection.services[0].ordinaryInputs.baggageCount;
  assert.ok(hooks.airportQuoteReadiness(requiredState,{option:requiredState.selectedEvent.snapshot.packages[0].options[0],service:requiredState.selectedEvent.snapshot.packages[0].options[0].services[0],arrival:true}).missing.includes(labels('es').baggageCount),'an explicitly required baggage configuration remains required');
  const airportSelect=initial.match(/<select[^>]*data-package-field="service:arrival-service:ordinary-airportId"[^>]*>(.*?)<\/select>/)[1];
  assert.ok(airportSelect.includes('value="" selected'));assert.ok(!airportSelect.includes('value="tlc"'));
  const passengers=[...initial.matchAll(/data-package-band="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(passengers,['van_1_2','van_3_4','van_5_6']);
  assert.ok(!initial.includes('data-package-field="passengers"'));assert.equal(controller.state.selection.passengerBand,'');assert.equal(controller.state.selection.passengerCount,undefined);
  assert.ok(initial.includes('ordinary-flight'));assert.ok(initial.includes('ordinary-baggageCount'));
  assert.ok(initial.includes('Número de vuelo (opcional)'));assert.ok(initial.includes('Si lo conoce, lo usaremos para coordinar la recogida.'));
  assert.ok(initial.includes('Número de maletas (opcional)'));assert.ok(initial.includes('Puede indicarlo si desea facilitar la coordinación.'));
  assert.ok(!hooks.configuration(controller.state,'mobile').includes('events-package-airport__form'));
  mobile=true;assertSameControls(render(),hooks.configuration(controller.state,'mobile'),'desktop and mobile keep the same Airport fields',false);mobile=false;
  const tripMobile=hooks.configuration(controller.state,'mobile');
  assert.ok(tripMobile.includes('Datos del viaje'));
  assert.ok(tripMobile.includes('data-package-conditions-only aria-haspopup="dialog"'));
  assert.ok(!tripMobile.includes('<details class="events-package-option-copy"'));
  assert.ok(tripMobile.includes('events-package-mobile-airport'));
  assert.ok(!tripMobile.includes('data-package-service-title'));
  assert.ok(!tripMobile.includes('<details class="events-package-service-disclosure"'));
  assert.ok(!tripMobile.includes('Editorial day · 2026-10-29'));
  assert.match(tripMobile,/data-package-mobile-address-clear[^>]* hidden/,'an unresolved Airport address keeps its Events-owned clear action hidden');
  assert.ok(tripMobile.includes('data-package-date-choice')&&tripMobile.includes('type="time"'),'the bounded date choice and native time control remain operative');
  assert.ok(!tripMobile.includes('events-package-airport-timezone'),'mobile does not repeat the CDMX date label below the controls');
  assert.ok(!tripMobile.includes('events-package-baggage-help'),'mobile keeps the compact luggage label without explanatory duplication');
  assert.ok(!tripMobile.includes(labels('es').baggageOptionalHelp));
  assert.ok(!tripMobile.includes(labels('es').flightOptionalHelp));
  assert.match(tripMobile,/airport-mobile-luggage__label">[^<]+<\/span>/,'mobile keeps one compact luggage label');
  assert.ok(tripMobile.includes('Número de vuelo (opcional)'));
  assert.ok(!tripMobile.includes('data-package-action="quote"'),'mobile Airport never exposes the manual calculation action');
  const previousCatalog=window.PixkuyAirportTariffCatalog;
  window.PixkuyAirportTariffCatalog={...(previousCatalog||{}),resolveDisplayLabel:(type,id)=>type==='zone'&&id==='reforma'?'Reforma':id};
  const resolvedMobileState=copy(controller.state);
  resolvedMobileState.selection.passengerBand='van_3_4';
  resolvedMobileState.selection.services=[{serviceId:'arrival-service',ordinaryInputs:{airportId:'mex',destination:{address:'Synthetic selected hotel',placeId:'synthetic-selected-hotel'},date:'2026-10-29',time:'12:30',baggageCount:2,flight:'SYN123'}}];
  resolvedMobileState.quoteStatus='ready';resolvedMobileState.quote={calculation:{serviceLines:[{serviceId:'arrival-service',zoneIds:['reforma']}]}};
  const resolvedTripMobile=hooks.mobileOrdinaryInputs(service,resolvedMobileState.selection.services[0],'service:arrival-service:',resolvedMobileState,true);
  assert.match(resolvedTripMobile,/data-package-mobile-address-clear aria-label="[^"]+"><span/,'a selected Airport destination exposes one labelled clear action');
  assert.ok(resolvedTripMobile.includes('events-package-mobile-airport__zone')&&resolvedTripMobile.includes('Reforma'),'the canonical quoted zone is shown beneath the selected destination');
  window.PixkuyAirportTariffCatalog=previousCatalog;
  const conditionOnly=hooks.packageDetailsContent(controller.state.selectedEvent,controller.state.selectedEvent.snapshot.packages[0],true,true);
  assert.ok(!conditionOnly.includes('Qué incluye'));
  assert.equal((conditionOnly.match(/Full condition text/g)||[]).length,2,'both commercial condition scopes are preserved');
  const previousSheet=window.PixkuyAirportMobileHotelSearchSheet,previousAdapter=window.PixkuyServicesEventsSpecialAddress;
  const addressError={textContent:'',hidden:true};let addressCallbacks,addressOpen,addressCloseCount=0;const addressListeners={};
  const mobileAddressInput={value:'Selected before edit',readOnly:false,isConnected:true,attrs:{'data-package-field':'service:arrival-service:ordinary-destination','data-package-mobile-address-input':'','data-package-mobile-lodging-input':'','data-package-mobile-address-title':'Dirección'},hasAttribute(name){return Object.hasOwn(this.attrs,name);},getAttribute(name){return this.attrs[name]??null;},setAttribute(name,value){this.attrs[name]=String(value);},addEventListener(name,listener){addressListeners[name]=listener;}};
  const mobileClearListeners={};const mobileAddressClear={addEventListener(name,listener){mobileClearListeners[name]=listener;}};
  const mobileAddressHost={getAttribute:()=> 'service:arrival-service:ordinary-destination',querySelector:selector=>selector==='input'?mobileAddressInput:selector==='[data-package-address-clear]'?null:selector==='[data-package-mobile-address-clear]'?mobileAddressClear:selector==='[data-package-address-error]'?addressError:{}};
  const mobileAddressRoute={};const mobileAddressRoot={packageAddresses:[],getAttribute:()=> 'mobile',closest:()=>mobileAddressRoute,querySelectorAll:()=>[mobileAddressHost]};
  window.PixkuyServicesEventsSpecialAddress={mount(options){addressCallbacks=options;return {destroy(){}};}};
  window.PixkuyAirportMobileHotelSearchSheet={openForField(options){addressOpen=options;options.mount({value:'Typed but unselected'}, {parentElement:{}});return true;},closeForField(){addressCloseCount++;return true;}};
  controller.state.selection.services=[{serviceId:'arrival-service',ordinaryInputs:{destination:{address:'Selected before edit',placeId:'selected-before-edit'}}}];
  hooks.mountAddresses(mobileAddressRoot);addressListeners.click();
  assert.equal(Object.hasOwn(addressOpen,'title'),false,'Events uses the original Airport sheet contract');assert.equal(mobileAddressInput.readOnly,true);
  addressCallbacks.onManualInput();addressCallbacks.onClearSelection();
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,'selected-before-edit','unselected sheet text remains transient');
  assert.equal(mobileAddressInput.value,'Selected before edit','cancel-safe search does not overwrite the committed field');
  addressCallbacks.onPlaceSelected({label:'Missing identity'});
  assert.equal(addressError.hidden,false);assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,'selected-before-edit','an incomplete Places result cannot replace the valid destination');
  addressError.hidden=true;addressCallbacks.onPlaceSelected({label:'Selected after edit',placeId:'selected-after-edit'});
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,'selected-after-edit');assert.equal(addressError.hidden,true);assert.equal(addressCloseCount,2);
  controller.state.quote={source:'published',quoteFingerprint:'a'.repeat(64)};controller.state.quoteStatus='ready';
  mobileClearListeners.click({preventDefault(){},stopPropagation(){}});
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination,undefined,'the Events-owned clear action removes the committed place object');
  assert.equal(controller.state.quote,null,'clearing the destination invalidates its quote');assert.equal(mobileAddressInput.value,'');assert.equal(addressCloseCount,3);
  window.PixkuyAirportMobileHotelSearchSheet=previousSheet;window.PixkuyServicesEventsSpecialAddress=previousAdapter;
  let inlineError=null,isValid=false;const validationAttrs={'data-package-description':'baggage-help'};
  const validationContainer={querySelector(){return inlineError;},appendChild(node){inlineError=node;}};
  const invalidBaggage={disabled:false,validationMessage:'Use un entero no negativo',checkValidity:()=>isValid,closest:()=>validationContainer,getAttribute:name=>validationAttrs[name]||'',setAttribute(name,value){validationAttrs[name]=String(value);},removeAttribute(name){delete validationAttrs[name];}};
  assert.equal(hooks.validateField(root,invalidBaggage,4),false);assert.equal(validationAttrs['aria-invalid'],'true');assert.equal(validationAttrs['aria-describedby'],'baggage-help package-error-desktop-4');assert.equal(inlineError.attributes.role,'alert');
  isValid=true;assert.equal(hooks.validateField(root,invalidBaggage,4),true);assert.equal(validationAttrs['aria-describedby'],'baggage-help');assert.equal(inlineError.removed,true);
  const clone=copy(controller.state);
  clone.selectedEvent.snapshot.packages[0].options[0].services.push(copy(service));
  assertSameControls(hooks.configuration(clone,'desktop'),hooks.configuration(clone,'mobile'),'multiple Airport services keep their existing controls and manual calculation');
  clone.selectedEvent.snapshot.packages[0].options[0].services=[{...service,id:'direct-service',ordinary:{baseService:'direct_transfer',inputs:{origin:{source:'customer'},destination:{source:'customer'},date:{source:'customer'},time:{source:'customer'},baggageStatus:{source:'deferred'}}}}];
  const directMobile=hooks.configuration(clone,'mobile');
  assertSameControls(hooks.configuration(clone,'desktop'),directMobile,'Direct fields and actions unchanged');
  assert.ok(directMobile.includes('events-package-trip--direct'));
  assert.ok(directMobile.includes('events-package-trip__schedule--direct has-passengers'));
  assert.ok(!directMobile.includes('<details class="events-package-service-disclosure"'),'recognized Direct service is directly visible on mobile');
  assert.equal((directMobile.match(/data-package-mobile-band/g)||[]).length,1,'Direct renders the option passenger selector once');
  assert.equal((directMobile.match(/data-package-mobile-address-input/g)||[]).length,2,'Direct routes both addresses through the mobile search presentation');
  assert.ok(!directMobile.includes('data-package-mobile-address-clear'),'this Airport-only design does not alter Direct Transfer markup');
  clone.selectedEvent.snapshot.packages[0].options[0].services=[{...service,id:'hourly-service',ordinary:{baseService:'hourly_daily',inputs:{origin:{source:'customer'},mode:{source:'fixed',value:'hourly'},durationHours:{source:'customer'},date:{source:'customer'},time:{source:'customer'},baggageStatus:{source:'deferred'}}}}];
  const hourlyMobile=hooks.configuration(clone,'mobile');
  assertSameControls(hooks.configuration(clone,'desktop'),hourlyMobile,'Hourly fields and actions unchanged');
  assert.ok(hourlyMobile.includes('events-package-trip--hourly'));
  assert.ok(hourlyMobile.includes('events-package-trip__schedule--hourly'));
  assert.ok(!hourlyMobile.includes('<details class="events-package-service-disclosure"'),'recognized Hourly service is directly visible on mobile');
  assert.equal((hourlyMobile.match(/data-package-mobile-band/g)||[]).length,1,'Hourly renders the option passenger selector once');
  assert.equal((hourlyMobile.match(/data-package-mobile-address-input/g)||[]).length,1,'Hourly pickup uses the mobile search presentation');
  assert.ok(!hourlyMobile.includes('data-package-mobile-address-clear'),'this Airport-only design does not alter Hourly markup');
  clone.selectedEvent.snapshot.packages[0].options[0].services=[{...service,id:'legacy-service',ordinary:{baseService:'historical_unknown',inputs:{origin:{source:'customer'},date:{source:'customer'}}}}];
  const legacyMobile=hooks.configuration(clone,'mobile');
  assert.ok(legacyMobile.includes('<details class="events-package-service-disclosure"'),'unknown historical service keeps the disclosure fallback');
  assert.ok(legacyMobile.includes('events-package-trip--legacy'));
  const departure=copy(controller.state);departure.selectedEvent.snapshot.packages[0].options[0].services[0].ordinary.inputs.direction.value='destination_to_airport';
  const departureHtml=hooks.configuration(departure,'desktop');
  assert.ok(departureHtml.indexOf('Alojamiento o dirección de recogida')<departureHtml.indexOf('Aeropuerto de salida'));
  assert.ok(departureHtml.includes('Hora de recogida'));assert.ok(!departureHtml.includes('Aeropuerto de llegada'));
  const fixed=copy(controller.state);const inputs=fixed.selectedEvent.snapshot.packages[0].options[0].services[0].ordinary.inputs;
  inputs.date={source:'fixed',value:'2026-10-29'};inputs.flight={source:'fixed',redacted:true};inputs.baggageStatus={source:'deferred'};
  const fixedHtml=hooks.configuration(fixed,'desktop');
  assert.ok(fixedHtml.includes('29 de octubre de 2026'));
  assert.ok(!fixedHtml.includes('data-package-field="service:arrival-service:ordinary-date"'));
  assert.ok(!fixedHtml.includes('data-package-field="service:arrival-service:ordinary-flight"'));
  assert.ok(fixedHtml.includes('Definido por el evento'));assert.ok(fixedHtml.includes('Pendiente para coordinación posterior'));
  for(const lang of ['es','en','de','fr','it','ko','pt','ru','zh-hans']){
    window.__pixkuyI18nLang=lang;window.__pixkuyI18nDict.eventPackages=labels(lang);
    const html=render();
    for(const key of ['eventUnavailable','continueContact','editTransfer','editTransfers','missingForQuote','invalidForQuote','automaticQuotePending','retryCalculation','optional','flightOptionalHelp','baggageOptionalHelp','vehicleCategoryLabel','vehicleGalleryOpen','vehicleFareLabel'])assert.equal(typeof labels(lang)[key],'string',lang+': '+key);
    for(const key of ['missingForQuote','invalidForQuote'])assert.ok(labels(lang)[key].includes('{fields}'),lang+': '+key+' placeholder');
    for(const key of ['configureTransferTitle','arrivalAirport','arrivalAddress','transferDate','transferStartTime','transferLocalTime','transferFlight','transferPrice','missingForQuote','backToPackages','flightOptionalHelp','baggageOptionalHelp'])assert.ok(html.includes(labels(lang)[key].split('{fields}')[0]),lang+': '+key);
    assert.ok(html.includes('Welcome · Llegada'),'published names retain Spanish fallback');
  }
  window.__pixkuyI18nLang='es';window.__pixkuyI18nDict.eventPackages=labels('es');
  const change=(key,value)=>hooks.changeField({getAttribute:()=>key==='passengers'?key:'service:arrival-service:ordinary-'+key,value},true);
  const submissionsBefore=runtime.calls.filter(c=>c.kind==='submit').length;
  const priceNode={innerHTML:''},actionNode={innerHTML:''};
  root.querySelector=selector=>selector==='[data-airport-price]'?priceNode:selector==='[data-airport-actions]'?actionNode:null;
  controller.state.quote=null;controller.state.quoteStatus='idle';
  hooks.roots.add(root);
  await hooks.handleClick(root,{target:{closest:()=>({disabled:false,getAttribute:name=>name==='data-package-band'?'van_3_4':null})}});change('airportId','nlu');change('date','2026-10-30');change('time','09:35');
  let mountOptions,focus;
  const addressInput={value:'',getAttribute:()=> 'service:arrival-service:ordinary-destination',addEventListener(name,listener){focus=listener;}};
  window.PixkuyServicesEventsSpecialAddress={mount(options){mountOptions=options;return {destroy(){}};}};
  hooks.mountAddresses({querySelectorAll:()=>[{getAttribute:()=> 'service:arrival-service:ordinary-destination',querySelector:selector=>selector==='input'?addressInput:selector==='[data-package-address-clear]'?null:{}}]});
  focus();mountOptions.onPlaceSelected({label:'Synthetic address',placeId:'synthetic-selected-place'});
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,'synthetic-selected-place');
  assert.equal(hooks.airportQuoteReadiness(controller.state,{option:candidate.snapshot.packages[0].options[0],service,arrival:true}).ready,true,'the selected destination remains quoteable without flight or baggage');
  change('flight','');
  const requests=[],resolvers=[];
  window.PixkuyEventPackagesApi.quote=payload=>{requests.push(copy(payload));return new Promise(resolve=>resolvers.push(resolve));};
  const result={source:'published',quoteFingerprint:'e'.repeat(64),calculation:{calculationModel:'ordinary_services',coverageStatus:'verified',serviceCount:1,pendingCodes:[],conditions:[],priceBreakdown:{priceStatus:'quoted',pricedSubtotal:'12345',currency:'MXN',automaticAddOns:[]},serviceLines:[]}};
  const click=action=>hooks.handleClick(root,{target:{closest:()=>({disabled:false,getAttribute:name=>name==='data-package-action'?action:null})}});
  const wait=delay=>new Promise(resolve=>setTimeout(resolve,delay));
  const htmlBeforeAutoQuote=root.innerHTML;
  assert.equal(hooks.airportQuoteReadiness(controller.state,{option:candidate.snapshot.packages[0].options[0],service,arrival:true}).ready,true,'the complete Airport selection quotes without flight or baggage');
  assert.ok(priceNode.innerHTML.includes(labels('es').automaticQuotePending));
  assert.ok(actionNode.innerHTML.includes('data-package-action="airport-review"'));
  assert.ok(actionNode.innerHTML.includes('aria-disabled="true"'));
  assert.ok(!actionNode.innerHTML.includes('data-package-action="quote"'));
  hooks.scheduleAirportAutoQuote(root);hooks.scheduleAirportAutoQuote(root);
  await wait(360);
  assert.equal(requests.length,1,'debounced scheduling emits one automatic quote request');
  assert.equal(controller.state.quoteStatus,'loading');assert.ok(priceNode.innerHTML.includes(labels('es').transferCalculating));
  assert.equal(requests[0].services[0].ordinaryInputs.destination.placeId,'synthetic-selected-place');
  assert.equal(requests[0].passengerBand,'van_3_4');assert.equal(requests[0].passengerCount,undefined);assert.equal(requests[0].services[0].ordinaryInputs.flight,undefined);
  assert.equal(requests[0].services[0].ordinaryInputs.baggageCount,undefined);
  resolvers[0](result);await wait(0);
  assert.equal(controller.state.step,'services');assert.ok(priceNode.innerHTML.includes('123.45 MXN'));
  assert.ok(actionNode.innerHTML.includes('Continuar'));
  assert.equal(actionNode.innerHTML.split('data-package-action="airport-review"').length-1,1);
  assert.equal(root.innerHTML,htmlBeforeAutoQuote,'automatic quote updates status and actions without remounting the form');
  let invalidFocused=false;
  const invalid={disabled:false,checkValidity:()=>false,setAttribute(){},parentElement:{querySelector:()=>({})},validationMessage:'Synthetic date outside allowed range',closest:()=>null,focus(){invalidFocused=true;}};
  root.querySelectorAll=()=>[invalid];
  await click('airport-review');assert.equal(controller.state.step,'services');assert.equal(invalidFocused,true,'review retains native validity and focus');
  root.querySelectorAll=()=>[];
  await click('airport-review');assert.equal(controller.state.step,'review');
  assert.equal(controller.state.selection.services[0].ordinaryInputs.flight,undefined);assert.equal(controller.state.selection.services[0].ordinaryInputs.baggageCount,undefined,'returning from review retains unanswered optional fields');
  assertSameControls(hooks.configuration(controller.state,'desktop'),hooks.configuration(controller.state,'mobile'),'review content and actions unchanged');
  await click('edit-services');
  await click('packages');controller.go('services');
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,'synthetic-selected-place');
  change('flight','SYN124');
  change('time','10:05');change('time','10:10');
  assert.equal(controller.state.quote,null);assert.ok(priceNode.innerHTML.includes(labels('es').automaticQuotePending));
  assert.ok(actionNode.innerHTML.includes('aria-disabled="true"'));assert.ok(!actionNode.innerHTML.includes('data-package-action="quote"'));
  await wait(360);assert.equal(requests.length,2,'rapid input changes are debounced into one request');
  change('time','10:15');await wait(360);assert.equal(requests.length,3,'a changed input starts a fresh request while the older one is in flight');
  resolvers[2]({...result,quoteFingerprint:'f'.repeat(64)});await wait(0);
  resolvers[1](result);await wait(0);
  assert.equal(controller.state.quote.quoteFingerprint,'f'.repeat(64));assert.equal(controller.state.step,'services');
  change('time','10:20');await wait(360);assert.equal(requests.length,4);
  change('time','10:25');change('time','10:20');resolvers[3](result);await wait(0);await wait(360);
  assert.equal(requests.length,5,'returning to a selection whose older request became stale schedules a fresh quote');
  resolvers[4]({...result,quoteFingerprint:'a'.repeat(64)});await wait(0);assert.equal(controller.state.quote.quoteFingerprint,'a'.repeat(64));
  let errorCalls=0;window.PixkuyEventPackagesApi.quote=async()=>{errorCalls++;throw Error('SYNTHETIC_CALCULATION_ERROR');};
  change('flight','SYN-ERROR');await wait(360);await wait(0);
  assert.equal(controller.state.quoteStatus,'error');assert.ok(!priceNode.innerHTML.includes('123.45 MXN'),'failed recalculation cannot display old amount');
  assert.ok(priceNode.innerHTML.includes(labels('es').error));assert.ok(actionNode.innerHTML.includes(labels('es').retryCalculation));
  await wait(360);assert.equal(errorCalls,1,'an error waits for an explicit retry instead of looping');
  await click('airport-review');assert.equal(controller.state.step,'services');
  window.PixkuyEventPackagesApi.quote=async()=>result;await click('retry-quote');await wait(10);assert.equal(controller.state.quoteStatus,'ready');assert.ok(priceNode.innerHTML.includes('123.45 MXN'));
  window.PixkuyEventPackagesApi.quote=async()=>({...result,calculation:{...result.calculation,coverageStatus:'outside'}});
  change('flight','SYN-OUTSIDE');await wait(360);await wait(0);assert.ok(!priceNode.innerHTML.includes('123.45 MXN'));await click('airport-review');assert.equal(controller.state.step,'services');
  window.PixkuyEventPackagesApi.quote=async()=>({...result,calculation:{...result.calculation,coverageStatus:'pending',pendingCodes:['FLIGHT_PENDING'],priceBreakdown:{...result.calculation.priceBreakdown,priceStatus:'conditional',pricedSubtotal:null}}});
  change('flight','SYN-PENDING');await wait(360);await wait(0);assert.ok(!priceNode.innerHTML.includes('123.45 MXN'));
  await click('airport-review');assert.equal(controller.state.step,'review','canonical assessment of pending data is preserved');
  controller.go('services');
  let lateResolve;window.PixkuyEventPackagesApi.quote=()=>new Promise(resolve=>{lateResolve=resolve;});change('flight','SYN-LATE');await wait(360);assert.equal(controller.state.quoteStatus,'loading');
  await click('packages');lateResolve(result);await wait(0);assert.equal(controller.state.step,'package');assert.equal(controller.state.quote,null,'leaving Services discards a late automatic quote');
  let invalidQuoteCalls=0;window.PixkuyEventPackagesApi.quote=async()=>{invalidQuoteCalls++;return result;};controller.go('services');addressInput.value='Typed replacement';mountOptions.onManualInput();
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,undefined);
  assert.ok(priceNode.innerHTML.includes(labels('es').invalidForQuote.split('{fields}')[0]));
  await wait(360);assert.equal(invalidQuoteCalls,0,'an unusable Places value never invokes quote');
  mountOptions.onClearSelection();assert.equal(controller.state.selection.services[0].ordinaryInputs.destination,undefined);assert.ok(priceNode.innerHTML.includes(labels('es').missingForQuote.split('{fields}')[0]));await wait(360);assert.equal(invalidQuoteCalls,0,'missing data never invokes quote');
  window.PixkuyEventPackagesApi.quote=async()=>result;
  hooks.cancelAirportAutoQuote();
  const originalSurface=root.getAttribute;
  root.getAttribute=name=>name==='data-event-package-root'?'mobile':originalSurface.call(root,name);
  mobile=true;
  let mobileAutomaticQuotes=0;
  window.PixkuyEventPackagesApi.quote=async payload=>{mobileAutomaticQuotes++;requests.push(copy(payload));return result;};
  mountOptions.onPlaceSelected({label:'Synthetic mobile address',placeId:'synthetic-mobile-place'});
  await wait(360);
  assert.equal(mobileAutomaticQuotes,1,'the mobile Airport surface starts one quote automatically when the final required field becomes ready');
  assert.equal(controller.state.step,'services','automatic calculation never navigates');
  assert.equal(controller.state.quoteStatus,'ready');
  const mobileQuotedMarkup=hooks.configuration(controller.state,'mobile');
  assert.ok(mobileQuotedMarkup.includes('events-package-vehicle-card'),'mobile presents the quoted Airport vehicle card next to its action');
  assert.ok(!mobileQuotedMarkup.includes('events-package-summary'),'the vehicle card replaces the generic pre-review summary');
  assert.ok(!mobileQuotedMarkup.includes('data-package-action="quote"'),'the final mobile quote card contains no manual calculation action');
  const desktopMarkup=hooks.configuration(controller.state,'desktop');
  assert.ok(!desktopMarkup.includes('events-package-summary'),'generic desktop composition is unchanged');
  let mobileCloses=0;
  window.PixkuyEventsMobileBookingFlow={close(options){assert.equal(options.updateUrl,true);mobileCloses++;}};
  root.getAttribute=name=>name==='data-event-package-root'?'mobile':originalSurface.call(root,name);
  await click('contact');assert.equal(controller.state.step,'review','mobile uses the same explicit review transition');
  assert.equal(mobileCloses,0,'the mobile review remains inside the Events route');
  assert.ok(root.innerHTML.includes('data-package-mobile-contact'),'the mobile route renders review and contact instead of becoming blank');
  root.getAttribute=originalSurface;
  mobile=false;
  assert.equal(runtime.calls.filter(c=>c.kind==='submit').length,submissionsBefore,'all navigation and quote paths avoid submission');
  hooks.roots.delete(root);window.PixkuyServicesEventsSpecialAddress=null;
  await assertAirportControls(runtime,candidate,hooks);
  controller.go('services');
  for(const band of ['van_1_2','van_3_4','van_5_6']){
    controller.state.quote=result;controller.state.quoteStatus='ready';
    await hooks.handleClick(root,{target:{closest:()=>({disabled:false,getAttribute:name=>name==='data-package-band'?band:null})}});
    assert.equal(controller.state.selection.passengerBand,band);assert.equal(controller.state.selection.passengerCount,undefined);
    assert.equal(controller.state.quote,null,'Band change invalidates quote');
    assert.ok(render().includes('data-package-band="'+band+'" aria-pressed="true"'));
  }
  for(const [raw,count] of [['0',0],['3',3],['',undefined]]){
    change('baggageCount',raw);
    assert.equal(controller.state.selection.services[0].ordinaryInputs.baggageCount,count);
    assert.equal(controller.state.selection.services[0].ordinaryInputs.baggageStatus,undefined);
  }
  controller.state.quote={...result,calculation:{...result.calculation,serviceLines:[{serviceId:'arrival-service',baggage:{count:3,status:'declared'}}]}};
  controller.state.quoteStatus='ready';controller.go('review');
  const sharedSummary=window.PixkuyEventPackagesConfig.contactSummary(controller.state);assert.ok(sharedSummary.includes('5–6'));assert.ok(sharedSummary.includes('Número de maletas: 3'));
  const savedState={...controller.state};
  controller.state.screen='receipt';controller.state.receipt={...runtime.receipt,requestKind:'package',passengerBand:'van_3_4',passengerSource:'band',baggage:[{serviceId:'arrival-service',count:0,status:'none'}]};
  hooks.renderRoot(root);assert.ok(root.innerHTML.includes('3–4'));assert.ok(root.innerHTML.includes('Número de maletas: 0'));
  controller.state.receipt={...controller.state.receipt,passengerSource:undefined,passengerCount:3};
  hooks.renderRoot(root);assert.ok(root.innerHTML.includes('3 · cantidad exacta histórica'));
  Object.assign(controller.state,savedState);
  const fixedUnavailable=copy(candidate);fixedUnavailable.id='no-bands';
  fixedUnavailable.snapshot.packages[0].options[0].calculationModel='fixed';fixedUnavailable.snapshot.packages[0].options[0].rates={};
  fixedUnavailable.snapshot.packages[0].options[0].services=[];
  controller.selectEvent(fixedUnavailable,false);controller.choose('welcome','arrival');controller.go('services');
  assert.ok(render().includes(labels('es').noCompatibleBand));assert.ok(!render().includes('data-package-band='));
  console.log(JSON.stringify({suite:'bands-baggage-landing',status:'PASS',cases:['three-selections-and-invalidation','no-exact-input','zero-positive-absent','review-and-receipt','historic-exact-display','no-bands-unavailable'],externalCalls:0,visualAcceptance:false}));
  console.log(JSON.stringify({status:'PASS',suite:'event-packages-airport-desktop',cases:['capability-gate','route-schedule-extras-conditions','service-period-inclusive-lower-exclusive-upper','no-day-autofill','fixed-local-date','canonical-passenger-bands','airport-allowlist-no-default','arrival-departure','flight-baggage-sources','nine-locales','places-retention-and-free-edit','missing-and-invalid-status','automatic-debounce-and-duplicate-suppression','mobile-automatic-single-request','mobile-no-manual-quote','mobile-compact-optional-fields','silent-status-without-form-remount','quote-loading-result-error-explicit-retry','late-response-rejected','leaving-services-discards-late-quote','explicit-review-no-submission','pending-assessment-preserved','outside-no-price','dynamic-mobile-presenters-and-legacy-fallback','transient-mobile-address-and-inline-errors','steps-one-three-unchanged'],externalCalls:0,visualAcceptance:false}));
}
async function assertAirportControls(runtime,candidate,hooks){
  const {window,controller,context}=runtime;
  window.matchMedia=()=>({matches:false});
  controller.selectEvent(candidate,false);controller.go('services');
  // Minimal DOM nodes in the existing canonical unit runner, not a visual substitute.
  function node(tag='div'){
    const n={tag,children:[],attrs:{},dataset:{},listeners:{},value:'',textContent:'',hidden:false,className:'',classList:{add(){},remove(){},toggle(){}},
      appendChild(child){this.children.push(child);return child;},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]||null;},removeAttribute(k){delete this.attrs[k];},
      addEventListener(k,fn){this.listeners[k]=fn;},focus(){this.focused=true;this.listeners.focus?.();},scrollIntoView(){},
      querySelectorAll(){return this.children.flatMap(child=>[...(child.tag==='button'?[child]:[]),...child.querySelectorAll()]);},
      querySelector(){return null;},emit(k,extra={}){this.listeners[k]?.({target:this,preventDefault(){},stopPropagation(){},...extra});}
    };
    Object.defineProperty(n,'innerHTML',{get(){return this._innerHTML||'';},set(value){this._innerHTML=String(value||'');this.children=[];}});
    return n;
  }
  const oldCreate=context.document.createElement;
  context.document.createElement=tag=>node(tag);
  for(const name of ['data/airport-zone-catalog.js','airport-tariff/airport-tariff-utils.js','airport-tariff/airport-tariff-catalog.js','airport-tariff/airport-tariff-dropdowns.js']){
    const file=path.join(ROOT,'assets/js',name);vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  }
  const airportLabels=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/i18n/es.json'),'utf8'));
  window.__pixkuyI18nDict.services.cards.airport=airportLabels.services.cards.airport;
  const html=hooks.configuration(controller.state,'desktop');
  assert.ok(html.includes('data-package-airport'));
  assert.ok(html.includes('services-expand__control--select'));
  const mex=window.PixkuyAirportTariffCatalog.resolveDisplayLabel('airport','mex');
  assert.ok(mex.length>4);assert.ok(html.includes(mex));
  const native=html.match(/<select[^>]*data-package-field="service:arrival-service:ordinary-airportId"[^>]*>/)[0];
  assert.ok(native.includes('hidden'));
  assert.ok(!html.includes('value="tlc"'),'published airport allowlist remains authoritative');
  assert.ok(html.includes('services-hourly-panel__disclaimer-group'));
  assert.ok(!html.includes('<summary>Condiciones'));
  assert.equal(html.split('Full condition text').length-1,2);
  const control=node('button'),select=node('select'),host=node();
  select.options=[{value:'',textContent:'Select'},...['mex','nlu'].map(id=>({value:id,textContent:window.PixkuyAirportTariffCatalog.resolveDisplayLabel('airport',id)}))];
  select.attrs['data-package-field']='service:arrival-service:ordinary-airportId';
  host.querySelector=s=>s==='button'?control:select;host.contains=t=>t===control||t===host;
  const root={getAttribute:()=> 'desktop',querySelector:s=>s==='[data-package-airport]'?host:control};
  hooks.mountAirportSelector(root);
  const panel=host.children[0];
  control.emit('click');assert.equal(panel.hidden,false);assert.equal(control.attrs['aria-expanded'],'true');
  control.emit('keydown',{key:'ArrowDown'});control.emit('keydown',{key:'Enter'});
  assert.equal(controller.state.selection.services[0].ordinaryInputs.airportId,'nlu');
  // Exercise the real mobile picker's consumer branch: close and focus return
  // precede the package callback, with no ordinary Airport state mutation.
  const mobileFile=path.join(ROOT,'assets/js/services/airport-mobile-booking-flow.js');
  const mobileSource=fs.readFileSync(mobileFile,'utf8');
  const mobileAnchor='  window.PixkuyAirportMobileBookingFlow = {';
  assert.equal(mobileSource.split(mobileAnchor).length,2);
  const oldReady=context.document.readyState,oldQuery=context.document.querySelector;
  context.document.readyState='loading';
  vm.runInNewContext(mobileSource.replace(mobileAnchor,'  window.mobileAirportPickerTest={selectAirportFromMobilePicker,setConsumer:value=>{airportPickerConsumer=value;}};\n'+mobileAnchor),context,{filename:mobileFile});
  const mobilePicker=node(),returnControl=node('button');returnControl.isConnected=true;
  let applied=0;const consumer={allowedIds:['mex','nlu'],trigger:returnControl,onSelect:id=>{assert.equal(mobilePicker.hidden,true,'picker closes before applying selection');assert.equal(returnControl.focused,true);applied++;hooks.changeRootField({getAttribute:()=> 'mobile'},Object.assign(select,{value:id}));return true;}};
  context.document.querySelector=s=>s==='[data-airport-mobile-airport-picker]'?mobilePicker:null;
  window.mobileAirportPickerTest.setConsumer(consumer);
  assert.equal(window.mobileAirportPickerTest.selectAirportFromMobilePicker('tlc'),false,'the published restriction cannot be widened');
  assert.equal(applied,0);
  assert.equal(window.mobileAirportPickerTest.selectAirportFromMobilePicker('mex'),true);
  assert.equal(applied,1);assert.equal(mobilePicker.hidden,true);assert.equal(returnControl.attrs['aria-expanded'],'false');
  context.document.querySelector=oldQuery;context.document.readyState=oldReady;
  assert.equal(panel.hidden,true);assert.equal(control.focused,true);
  control.emit('click');control.emit('keydown',{key:'Escape'});assert.equal(panel.hidden,true);
  control.emit('click');root.closePackageAirport({});assert.equal(panel.hidden,true,'outside closes');
  control.emit('click');control.emit('keydown',{key:'Tab'});assert.equal(panel.hidden,true);
  control.emit('click');control.emit('keydown',{key:'Home'});control.emit('keydown',{key:'Enter'});
  assert.equal(controller.state.selection.services[0].ordinaryInputs.airportId,'mex','display alias never changes contract ID');
  control.emit('click');control.emit('keydown',{key:'End'});control.emit('keydown',{key:'Enter'});
  assert.equal(controller.state.selection.services[0].ordinaryInputs.airportId,'nlu');
  // A retired provider may still write its captured nodes; the new input and state stay clear.
  let input,mount,created=0,destroyed=0;const pending=[];
  const addressHost={getAttribute:()=> 'service:arrival-service:ordinary-destination',querySelector:s=>s==='input'?input:s==='[data-package-address-clear]'?clear:s==='[data-package-address-error]'?addressError:mount};
  const clear=node('button'),addressError=node();
  const makeInput=()=>{const x=node('input');x.attrs['data-package-field']='service:arrival-service:ordinary-destination';x.cloneNode=makeInput;x.replaceWith=next=>{input=next;};return x;};
  const makeMount=()=>{const x=node();x.cloneNode=makeMount;x.replaceWith=next=>{mount=next;};return x;};
  input=makeInput();mount=makeMount();input.value='Original synthetic destination';
  const priceNode=node(),actionNode=node();
  const addressRoot={packageAddresses:[],contains:()=>true,getAttribute:name=>name==='data-event-package-root'?'desktop':null,querySelector:selector=>selector==='[data-airport-price]'?priceNode:selector==='[data-airport-actions]'?actionNode:null};
  const adapter={mount(options){created++;pending.push(options);return {destroy(){destroyed++;}};}};
  controller.change(s=>{s.services[0].ordinaryInputs.destination={address:input.value,placeId:'old',lat:0,lng:0};s.services[0].ordinaryInputs.baggageCount=3;});
  controller.state.quote={source:'published',quoteFingerprint:'a'.repeat(64)};controller.state.quoteStatus='ready';
  const option=candidate.snapshot.packages[0].options[0],service=option.services[0];
  assert.equal(hooks.airportQuoteReadiness(controller.state,{option,service,arrival:true}).ready,true,'an initial canonical selection is valid without coordinate truthiness checks');
  hooks.mountClearableAddress(addressRoot,addressHost,adapter);
  input.focus();const oldInput=input,oldMount=mount;assert.equal(created,1);
  clear.emit('click');assert.equal(created,2);assert.equal(destroyed,1);
  assert.notEqual(input,oldInput);assert.notEqual(mount,oldMount);
  assert.equal(input.value,'');assert.equal(input.focused,true);assert.equal(clear.hidden,true);
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination,undefined);assert.equal(controller.state.quote,null);
  oldInput.value='Late old provider result';pending[0].onPlaceSelected({label:oldInput.value,placeId:'late'});
  assert.equal(input.value,'');assert.equal(controller.state.selection.services[0].ordinaryInputs.destination,undefined);
  input.value='New search';input.emit('input');assert.equal(clear.hidden,false);assert.equal(created,2,'typing does not remount Places');
  input.value='New selection';pending[1].onPlaceSelected({label:'New selection',placeId:'new-place'});
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,'new-place');
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.lat,undefined);
  input.emit('change');
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,'new-place','the browser change emitted after Places selection preserves canonical identity');
  const accepted=JSON.stringify(controller.state.selection);
  pending[0].onClearSelection();assert.equal(JSON.stringify(controller.state.selection),accepted,'old clear callback cannot erase a new selection');
  assert.equal(hooks.airportQuoteReadiness(controller.state,{option,service,arrival:true}).ready,true,'the replacement Places selection restores quote readiness');
  const payloads=[];window.PixkuyEventPackagesApi.quote=async payload=>{payloads.push(payload);return {source:'published',quoteFingerprint:'a'.repeat(64),calculation:{calculationModel:'ordinary_services',coverageStatus:'verified',serviceCount:1,pendingCodes:[],conditions:[],priceBreakdown:{priceStatus:'quoted',pricedSubtotal:'12345',currency:'MXN',automaticAddOns:[]},serviceLines:[]}};};
  hooks.roots.add(addressRoot);hooks.scheduleAirportAutoQuote(addressRoot,0);await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(controller.state.quoteStatus,'ready','a valid replacement destination triggers the automatic quote');
  assert.equal(payloads[0].services[0].ordinaryInputs.destination.placeId,'new-place');
  assert.equal(payloads[0].passengerBand,'van_3_4');assert.equal(payloads[0].passengerCount,undefined);assert.equal(payloads[0].services[0].ordinaryInputs.baggageCount,3);
  assert.ok(priceNode.innerHTML.includes('123.45 MXN'));
  input.value='Edited after selection';input.emit('input');
  assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,undefined,'a real edit still invalidates canonical identity');
  assert.equal(controller.state.quote,null,'editing the destination removes the previous price');
  assert.ok(!priceNode.innerHTML.includes('123.45 MXN'));
  pending[1].onError(new Error('SYNTHETIC_PLACE_DETAILS_ERROR'));
  assert.equal(addressError.hidden,false);assert.equal(addressError.textContent,window.__pixkuyI18nDict.eventPackages.placeDetailsError,'a details failure is explained beside the address');
  hooks.cancelAirportAutoQuote();hooks.roots.delete(addressRoot);
  input.value='Recovered destination';pending[1].onPlaceSelected({formattedAddress:'Recovered destination',placeId:'recovered-place'});
  assert.equal(addressError.hidden,true);assert.equal(controller.state.selection.services[0].ordinaryInputs.destination.placeId,'recovered-place');
  context.document.createElement=oldCreate;
  window.PixkuyAirportTariffDropdowns=null;
  console.log(JSON.stringify({status:'PASS',suite:'event-packages-airport-controls',cases:['real-airport-dropdown-helpers','canonical-labels-ids-restrictions','keyboard-escape-tab-outside','clear-full-geographic-object-and-quote','mobile-selected-place-clear-and-zone','mobile-airport-only-presentation','late-provider-writes-isolated','search-again-no-typing-remount','post-selection-change-preserves-place','replacement-selection-autoquotes','later-edit-removes-price','details-error-is-visible','preserved-band-and-baggage-count','full-visible-conditions'],externalCalls:0,visualAcceptance:false}));
}
async function assertPackageBandRecovery() {
  const receipt={requestKind:'package',reference:'EVT-SYNTHETIC-BAND',eventTitle:'Synthetic',passengerBand:'van_5_6',passengerSource:'band',requiredPassengerCapacity:6,baggage:[{serviceId:'synthetic-service',count:3,status:'declared'}],pendingCodes:[]};
  const runtime=packageRuntime({failSubmit:true,receipt});const {controller,request}=runtime;
  controller.selectEvent({id:'synthetic',publicationVersion:1,snapshot:{schemaVersion:3,packages:[{id:'p',options:[{id:'o',services:[]}]}]}},false);
  controller.choose('p','o');controller.change(s=>{s.passengerBand='van_5_6';s.services=[{serviceId:'synthetic-service',ordinaryInputs:{baggageCount:3}}];});
  controller.state.quote={source:'published',quoteFingerprint:'d'.repeat(64)};controller.state.quoteStatus='ready';
  controller.state.contact={name:'Synthetic',phone:'+520000000000',email:'synthetic@example.invalid'};
  await request.submit();
  const payload=runtime.calls.find(c=>c.kind==='submit').body;
  assert.equal(payload.passengerBand,'van_5_6');assert.equal(payload.passengerCount,undefined);assert.equal(payload.services[0].ordinaryInputs.baggageCount,3);
  const reloaded=packageRuntime({storage:runtime.storage,recoverReceipt:true,receipt});await reloaded.request.initialize();
  assert.deepEqual(reloaded.controller.state.receipt,receipt);assert.equal(reloaded.controller.state.selection,null);
  assert.equal(reloaded.calls.filter(c=>c.kind==='submit').length,0,'Recovery is a closed receipt, never a new request');
  console.log(JSON.stringify({suite:'bands-baggage-frozen-request-recovery',status:'PASS',externalCalls:0,databaseWrites:0}));
}
async function assertPackageRecoveryAndState() {
  const event={id:'11111111-1111-4111-8111-111111111111',publicationVersion:1};
  const runtime=packageRuntime({failSubmit:true});const {controller,request}=runtime;
  controller.selectEvent(event,true);controller.change(s=>{s.inquiry.notes='Texto privado sintético';});controller.state.contact={name:'Contacto sintético',phone:'+520000000000',email:'synthetic@example.invalid'};
  const earlier=controller.quote();controller.change(s=>{s.inquiry.notes='Cambio privado sintético';});const later=controller.quote();runtime.quotes[1]({source:'published',quoteFingerprint:'b'.repeat(64)});await later;runtime.quotes[0]({source:'published',quoteFingerprint:'a'.repeat(64)});await earlier;assert.equal(controller.state.quote.quoteFingerprint,'b'.repeat(64));
  controller.state.screen='catalog';controller.selectEvent(event,true);assert.equal(controller.state.selection.inquiry.notes,'Cambio privado sintético');assert.equal(controller.state.quote.quoteFingerprint,'b'.repeat(64));
  await request.submit();assert.equal(controller.state.requestStatus,'unknown');const first=runtime.calls.find(call=>call.kind==='submit');assert.ok(first);assert.notEqual(first.attempt.key,first.attempt.secret);assert.equal(first.attempt.key.length,64);
  controller.state.contact.name='Cambio posterior que no altera replay';await request.submit();const submitted=runtime.calls.filter(call=>call.kind==='submit');assert.equal(submitted.length,2);assert.deepEqual(submitted[1].body,first.body);assert.equal(submitted[1].attempt.key,first.attempt.key);
  const stored=[...runtime.storage.values()].join('');assert.ok(!stored.includes('synthetic@example.invalid'));assert.ok(!stored.includes('privado'));assert.deepEqual(Object.keys(JSON.parse(stored)).sort(),['createdAt','key','secret','site']);
  const reloaded=packageRuntime({storage:runtime.storage,recoverReceipt:true});await reloaded.request.initialize();assert.equal(reloaded.controller.state.requestStatus,'received');assert.equal(reloaded.controller.state.selection,null);assert.equal(reloaded.controller.state.contact.email,'');assert.equal(reloaded.calls.filter(c=>c.kind==='submit').length,0);await reloaded.request.submit();assert.equal(reloaded.calls.filter(c=>c.kind==='submit').length,0);
  const url=reloaded.request.whatsappUrl({...reloaded.receipt,contact:controller.state.contact,notes:'private-note',recoverySecret:first.attempt.secret,placeId:'private-place'});assert.ok(url.startsWith('https://wa.me/520000000000?text='));for(const excluded of ['private-note','private-place',first.attempt.secret,'synthetic@example.invalid'])assert.ok(!decodeURIComponent(url).includes(excluded));assert.ok(!decodeURIComponent(url).includes('MXN'));reloaded.request.newKnownRequest();assert.equal(reloaded.storage.size,0);assert.equal(reloaded.controller.state.requestStatus,'idle');
  const blocked=packageRuntime({storageBlocked:true});blocked.controller.selectEvent(event,true);blocked.controller.state.quote={source:'published',quoteFingerprint:'b'.repeat(64)};blocked.controller.state.quoteStatus='ready';await blocked.request.submit();assert.equal(blocked.controller.state.storageAvailable,false);assert.equal(blocked.calls.filter(c=>c.kind==='submit').length,0,'storage warning precedes first POST');await blocked.request.submit();assert.equal(blocked.calls.filter(c=>c.kind==='submit').length,1);
  const noCrypto=packageRuntime({noCrypto:true});noCrypto.controller.selectEvent(event,true);noCrypto.controller.state.quote={quoteFingerprint:'b'.repeat(64)};noCrypto.controller.state.quoteStatus='ready';await noCrypto.request.submit();assert.equal(noCrypto.calls.filter(c=>c.kind==='submit').length,0);assert.equal(noCrypto.controller.state.error,'CRYPTO_UNAVAILABLE');
  const fresh=packageRuntime();const anotherEvent={...event,id:'another-synthetic-event'};
  const rejected=packageRuntime();rejected.controller.selectEvent(event,true);rejected.controller.state.quote={quoteFingerprint:'d'.repeat(64)};rejected.controller.state.quoteStatus='ready';
  rejected.window.PixkuyEventPackagesApi.submit=async()=>{throw Object.assign(Error('REQUEST_INVALID'),{status:400});};
  await rejected.request.submit();assert.equal(rejected.controller.state.requestStatus,'error');assert.equal(rejected.controller.state.receipt,null);assert.equal(rejected.request.hasFrozenBody(),false);
  fresh.controller.selectEvent(anotherEvent,true);fresh.controller.change(s=>{s.inquiry.notes='Other draft preserved';});
  fresh.controller.selectEvent(event,true);fresh.controller.state.quote={quoteFingerprint:'b'.repeat(64)};fresh.controller.state.quoteStatus='ready';
  let receiptNotifications=0;fresh.controller.subscribe(()=>{if(fresh.controller.state.receipt){receiptNotifications++;assert.equal(fresh.request.hasFrozenBody(),false,'success publishes a consistent terminal state');}});
  await Promise.all([fresh.request.submit(),fresh.request.submit()]);assert.equal(fresh.calls.filter(c=>c.kind==='submit').length,1);assert.equal(receiptNotifications,1);
  const priorIdentity=fresh.calls.find(c=>c.kind==='submit').attempt.key;
  fresh.request.newKnownRequest();fresh.controller.selectEvent(anotherEvent,true);assert.equal(fresh.controller.state.selection.inquiry.notes,'Other draft preserved');
  fresh.controller.selectEvent(event,true);fresh.controller.state.quote={quoteFingerprint:'c'.repeat(64)};fresh.controller.state.quoteStatus='ready';await fresh.request.submit();
  assert.notEqual(fresh.calls.filter(c=>c.kind==='submit')[1].attempt.key,priorIdentity,'new deliberate request has a new idempotency identity');
  const expiredStore=new Map([['pixkuy.events.packages.attempt.v1:synthetic-site',JSON.stringify({site:'synthetic-site',key:'a'.repeat(64),secret:'b'.repeat(64),createdAt:Date.now()-24*60*60*1000})]]);const expired=packageRuntime({storage:expiredStore});await expired.request.initialize();expired.controller.selectEvent(event,true);await expired.request.submit();assert.equal(expired.calls.length,0);assert.equal(expiredStore.size,0);assert.equal(expired.controller.state.error,'RECOVERY_EXPIRED');
  let keys=null;for(const locale of ['es','en','de','fr','it','ko','pt','ru','zh-hans']){const data=JSON.parse(fs.readFileSync(path.join(ROOT,`assets/i18n/${locale}/services-events.json`),'utf8'));const current=Object.keys(data.eventPackages).sort();if(keys)assert.deepEqual(current,keys);keys=current;for(const value of Object.values(data.eventPackages))assert.ok(typeof value==='string'&&value.trim().length>0);}
  console.log(JSON.stringify({status:'PASS',suite:'event-packages-state-and-recovery',cases:['out-of-order-quotes','compatible-back-navigation','frozen-replay','token-only-storage','recover-on-reload','closed-received-form','whatsapp-allowlist','storage-warning-before-post','crypto-required','24h-local-expiry','nine-locales'],externalCalls:0}));
}

async function assertMobileRouteLifecycle() {
  // Same VM boundary as the canonical quote tests; execute the actual route module.
  const file=path.join(ROOT,'assets/js/services/events-mobile-booking-flow.js');
  const source=fs.readFileSync(file,'utf8');
  const anchor='  window.PixkuyEventsMobileBookingFlow = {';
  assert.equal(source.split(anchor).length-1,1);
  const nodes=new Map(),bodyAttributes=new Map(),listeners=new Map(),scrolls=[],opened=[];
  const node=name=>({dataset:{},innerHTML:'',textContent:'',addEventListener(type,listener){const key=name+':'+type;const existing=listeners.get(key)||[];existing.push(listener);listeners.set(key,existing);}});
  for(const name of ['[data-events-mobile-stack]','[data-events-mobile-flow-back]','[data-events-mobile-flow-title]','[data-events-mobile-flow-helper]'])nodes.set(name,node(name));
  const route={hidden:true,attributes:{},contains:()=>false,setAttribute(name,value){this.attributes[name]=value;},querySelector:selector=>nodes.get(selector)||null};
  let focused=0,closed=0;
  const document={readyState:'loading',title:'Synthetic Landing',activeElement:{focus(){focused++;}},addEventListener(){},body:{setAttribute(name,value){bodyAttributes.set(name,value);}}};
  const media={matches:true};
  const window={scrollY:240,scrollTo(options){scrolls.push(options.top);},matchMedia:()=>media,location:{href:'http://localhost:8888/?service=event_special'},history:{replaceState(){}},
    PixkuyEventsMobileConfigStep:{open(root,payload){assert.equal(root,route);opened.push(payload.group.id);return true;},close(){closed++;}},
    __pixkuyI18nDict:{eventPackages:{configureTransfer:'Configurar traslado',error:'No se pueden cargar eventos'},services:{cards:{events:{mobileFlow:{back:'Volver',title:'Próximos eventos',loading:'Cargando eventos',empty:'Sin eventos'},panel:{intro:'Contexto breve'}}}}}};
  const hook='  window.mobileRouteHooks={buildEventGroups,buildEventCardMarkup,buildStackMarkup,bindBack,bindStack,setStatus:function(loading,error){isLoading=loading;loadError=error;},setFixture:function(r,g){routeNode=r;routeContent={};groups=g;hasLoaded=true;venuesById={venue:{id:"venue",active:true,name:"Recinto"}};}};\n';
  vm.runInNewContext(source.replace(anchor,hook+anchor),{window,document,Intl,Date,URL,URLSearchParams,Number,Array},{filename:file});
  const hooks=window.mobileRouteHooks;
  const events=Array.from({length:12},(_,index)=>({id:'event-'+index,title:'Evento largo '+index,venueId:'venue',active:true,posterSrc:'/synthetic.webp',startsAtUtc:'2099-10-29T12:00:00Z',priority:index}));
  const groups=hooks.buildEventGroups(events,{venue:{active:true}});
  assert.equal(groups.length,12,'every eligible group, including the last one, remains reachable');
  for(const group of groups){const html=hooks.buildEventCardMarkup(group);assert.ok(html.includes('Configurar traslado'));assert.ok(html.includes('data-events-mobile-continue="'+group.id+'"'),'each card has a visible action without a preliminary selection');}
  hooks.setFixture(route,groups);
  for(let cycle=0;cycle<5;cycle++){
    hooks.bindStack();hooks.bindBack();await window.PixkuyEventsMobileBookingFlow.open();
    assert.equal(route.hidden,false);assert.equal(bodyAttributes.get('data-events-mobile-screen'),'true');
    window.PixkuyEventsMobileBookingFlow.close({updateUrl:true});
    assert.equal(route.hidden,true);assert.equal(bodyAttributes.get('data-events-mobile-screen'),'false');
  }
  assert.deepEqual(scrolls,[240,240,240,240,240]);assert.equal(focused,5);
  window.PixkuyEventsMobileBookingFlow.close();assert.equal(scrolls.length,5,'closing an inactive Events route cannot scroll another service');
  assert.equal(listeners.get('[data-events-mobile-stack]:click').length,1,'reopening never accumulates click listeners');
  assert.equal(listeners.get('[data-events-mobile-flow-back]:click').length,1);
  const card={getAttribute:()=>groups[11].id};
  listeners.get('[data-events-mobile-stack]:click')[0]({target:{closest:selector=>selector==='[data-events-mobile-event-group]'?card:null},preventDefault(){},stopPropagation(){}});
  assert.deepEqual(opened,['event-11'],'one activation opens the original ordinary-event configurator');
  hooks.setFixture(route,[]);hooks.setStatus(true,false);
  assert.ok(hooks.buildStackMarkup().includes('Cargando eventos'));
  hooks.setStatus(false,false);assert.ok(hooks.buildStackMarkup().includes('Sin eventos'));
  hooks.setStatus(false,true);assert.ok(hooks.buildStackMarkup().includes('role="alert"'));
  assert.ok(hooks.buildStackMarkup().includes('No se pueden cargar eventos'));
  assert.ok(hooks.buildStackMarkup().includes('data-events-mobile-catalog-retry'));
  media.matches=false;assert.equal(await window.PixkuyEventsMobileBookingFlow.open(),false,'desktop does not open or lock the mobile shell');
  assert.equal(closed,6);
  console.log(JSON.stringify({suite:'events-mobile-route-lifecycle',status:'PASS',cases:['all-eligible-events','one-activation','five-reopen-cycles','listener-count-stable','scroll-restoration','inactive-close-noop','loading-empty-error-retry','desktop-gate'],externalCalls:0,formSubmissions:0}));
}

async function run() {
  await assertMobileRouteLifecycle();
  await assertCompleteVariant("arrival");
  await assertCompleteVariant("departure");
  await assertCompleteVariant("round_trip");

  const runtime = createRuntime();
  const state = createState("round_trip");
  const step = createStep();

  runtime.hooks.setContext(createPayload(), state, step.node);
  assert.equal(runtime.hooks.getReturnPickupDayOffset("23:28"), 0);
  assert.equal(runtime.hooks.getReturnPickupDayOffset("01:28"), 1);
  state.returnPickupTime = "23:28";
  assert.equal(
    runtime.quoteModule.buildQuotePayload(runtime.hooks.getQuoteInput())
      .returnPickupDayOffset,
    0
  );
  state.returnPickupTime = "01:28";
  assert.equal(
    runtime.quoteModule.buildQuotePayload(runtime.hooks.getQuoteInput())
      .returnPickupDayOffset,
    1
  );

  runtime.hooks.setVariant("arrival");
  assert.equal(runtime.hooks.getQuoteInput().destinationAddress, undefined);
  runtime.hooks.setVariant("round_trip");
  assert.equal(runtime.hooks.getQuoteInput().originAddress.placeId, "origin-place");
  assert.equal(
    runtime.hooks.getQuoteInput().destinationAddress.placeId,
    "destination-place"
  );

  state.destinationAddressPlace = null;
  runtime.hooks.setContext(createPayload(), state, step.node);
  assert.equal(runtime.hooks.requestQuoteIfReady(), true);
  await flushQuote();
  assert.equal(runtime.posts.length, 0);
  assert.equal(runtime.hooks.getQuoteState().result.code, "INCOMPLETE_QUOTE_PAYLOAD");
  assert.equal(step.cta.disabled, true);

  const desktopSource = fs.readFileSync(DESKTOP_SOURCE_PATH, "utf8");
  assert.match(
    desktopSource,
    /input\.snapshotVersion = selectedEvent\.snapshotVersion;/
  );
  await assertPackageRecoveryAndState();
  await assertPackageBandRecovery();
  await assertOrdinaryPackageInputs();

  console.log(
    JSON.stringify({
      status: "PASS",
      suite: "events-mobile-quote",
      variants: ["arrival", "departure", "round_trip"],
      externalCalls: 0,
      formSubmissions: 0
    })
  );
}

run().catch(function onFailure(error) {
  console.error(error);
  process.exitCode = 1;
});
