(function(window,document){
  'use strict';
  var base=window.PixkuyAirportDesktopView;
  function trip(s){
    var list=base.node('dl','airport-booking__details');
    list.append(base.locationField(base.t('origin'),s.direct_transfer_origin_address),base.locationField(base.t('destination'),s.direct_transfer_destination_address),
      base.field(base.t('date'),base.date(s.direct_transfer_date)),base.field(base.t('time'),s.direct_transfer_time+' · '+base.t('timezone')),
      base.field(base.t('passengers'),s.direct_transfer_passenger_bucket_label));
    var estimate=window.PixkuyBookingPresentation.distanceTime(s.direct_transfer_distance_meters,s.direct_transfer_duration_seconds);
    if(estimate)list.appendChild(base.field(base.t('estimatedDuration'),estimate));return list;
  }
  function block(key,content,edit){
    var section=base.node('section','airport-booking__block'),heading=base.node('div','airport-booking__block-heading');
    heading.appendChild(base.node('h2','',base.t(key)));
    if(edit)heading.appendChild(base.action(base.t('edit'),edit,false,'edit',base.t('edit')+': '+base.t(key)));
    section.append(heading,content);return section;
  }
  function summary(s){
    var aside=base.node('aside','airport-booking__summary');
    aside.append(base.node('h2','',base.t('amountTitle')),base.vehicle(s),base.node('p','airport-booking__total',base.money(Number(s.direct_transfer_amount_minor)||Math.round(Number(s.direct_transfer_price)*100),s.direct_transfer_currency)));
    return aside;
  }
  window.PixkuyDirectDesktopView={trip:trip,block:block,summary:summary};
})(window,document);
