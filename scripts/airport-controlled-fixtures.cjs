'use strict';
// Existing intercepted smoke bodies, shared with the local manual boundary.
// Pure factories: no network, database, providers, logging or filesystem.
function precheck(payload, {models, requestNumber, available}) {
  return {status:'ok',result:{...payload,checkoutAllowed:available,
    price:{available:true,amountMinor:payload.expectedAmountMinor,expectedAmountMinor:payload.expectedAmountMinor,pricingVersion:'test-v1',quoteFingerprint:'a'.repeat(64)},
    availability:{available,status:available?'available':'unavailable',...(available?{}:{code:'NO_AVAILABILITY'})},
    fleet:{version:1,status:available?'available':'unavailable',requestKey:'offer-'+requestNumber,models:available?JSON.parse(JSON.stringify(models)):[],selectedModelEligible:true}}};
}
function status({source, selected, amount, service, state, canModify, canRetry, now=new Date()}) {
  const expires=new Date(now.getTime()+(state==='hold_expired'?-1000:30*60000));
  const draft={...source,airport_transfer_price:amount,airport_transfer_airport_label:'MEX — Aeropuerto Internacional Ciudad de México',airport_transfer_destination_label:'Hotel MX Condesa — Salamanca 35, Roma Norte, Ciudad de México',airport_transfer_passenger_bucket_label:'1–2',fleet_model:{id:selected.modelId,name:selected.name,revision:1,photoUrl:selected.photoUrl,amountMinor:amount,currency:'MXN'}};
  return {serverNow:now.toISOString(),hold:{expiresAt:expires.toISOString()},reservation:{serviceType:service,status:state==='processing'?'pending_payment':state,publicCode:'PKY-QA',pickupAddress:'MEX — Aeropuerto Internacional Ciudad de México',destinationAddress:'Hotel MX Condesa — Salamanca 35, Roma Norte, Ciudad de México',serviceStartLocalDate:source.airport_transfer_date,serviceStartLocalTime:source.airport_transfer_time,passengerLabel:'1–2',luggageCount:2,vehicleDisplayName:selected.name,vehiclePhotoUrl:selected.photoUrl,customerNotes:'Notas de prueba'},customer:{fullName:'Persona QA',email:'qa@example.com',phone:'+34612345678'},payment:{status:state==='confirmed'?'paid':'pending',amountExpected:amount,amountPaid:state==='confirmed'?amount:null,currency:'MXN'},actions:{canModify,canRetryCheckout:canRetry,canCreateNewReservation:state==='hold_expired'},edit:{allowed:canModify,revision:'synthetic-revision-1',draft:canModify?draft:null},continuation:state==='hold_expired'?{draft}:null};
}
function checkout(token='synthetic-integrated-only', checkoutUrl='https://checkout.stripe.com/c/pay/synthetic-integrated-only') {
  return {bookingStatusToken:token,checkoutUrl};
}
module.exports={precheck,status,checkout};
