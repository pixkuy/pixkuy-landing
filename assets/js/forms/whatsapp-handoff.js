(function (window, document) {
  'use strict';

  function getI18nValue(path, fallback) {
    var modules;
    var getValue;
    var dict;
    var parts;
    var value;
    var i;

    if (!path || typeof path !== 'string') {
      return fallback;
    }

    modules = window.__pixkuyI18nModules || {};
    getValue = modules.getValue;
    dict = window.__pixkuyI18nDict || null;

    if (typeof getValue === 'function' && dict) {
      value = getValue(dict, path);

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    value = dict;
    parts = String(path || '').split('.');

    for (i = 0; i < parts.length; i += 1) {
      if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, parts[i])) {
        return fallback;
      }

      value = value[parts[i]];
    }

    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  function getContactForm() {
    return document.querySelector('form[name="contact"]');
  }

  function getVisibleFieldValue(form, name) {
    var field;
    var value;

    if (!form || !name) {
      return '';
    }

    field = form.querySelector('[name="' + name + '"]');

    if (!field) {
      return '';
    }

    value = typeof field.value === 'string' ? field.value.trim() : '';
    return value;
  }

  function getAirportHotelSelectedFareKey() {
    var bridge;
    var bridgeState;
    var selectedFareKey;

    bridge = window.PixkuyAirportZoneTariff;

    if (!bridge || typeof bridge !== 'object' || typeof bridge.getState !== 'function') {
      return '';
    }

    bridgeState = bridge.getState();

    if (!bridgeState || typeof bridgeState !== 'object') {
      return '';
    }

    selectedFareKey = bridgeState.selectedFareKey;
    return typeof selectedFareKey === 'string' ? selectedFareKey.trim() : '';
  }

  function resolveAirportHotelPassengersLabel() {
    var utilsApi;
    var fareKey;

    utilsApi = window.PixkuyAirportTariffUtils;
    fareKey = getAirportHotelSelectedFareKey();

    if (
      !utilsApi ||
      typeof utilsApi !== 'object' ||
      typeof utilsApi.resolveFareKeyDisplayLabel !== 'function' ||
      !fareKey
    ) {
      return '';
    }

    return utilsApi.resolveFareKeyDisplayLabel(fareKey) || '';
  }

  function getAirportHotelEditorData(form) {
    var formsApi;
    var getTripSnapshot;
    var snapshot;

    if (!form) {
      return {
        origin: '',
        destination: '',
        passengers: '',
        tripDate: '',
        tripTime: ''
      };
    }

    formsApi = window.PixkuyForms;
    getTripSnapshot = formsApi && typeof formsApi.getContactAirportHotelTripSnapshot === 'function'
      ? formsApi.getContactAirportHotelTripSnapshot
      : null;

    if (!getTripSnapshot) {
      return {
        origin: '',
        destination: '',
        passengers: '',
        tripDate: getVisibleFieldValue(form, 'airport_hotel_date'),
        tripTime: getVisibleFieldValue(form, 'airport_hotel_time')
      };
    }

    snapshot = getTripSnapshot();

    if (!snapshot || typeof snapshot !== 'object') {
      return {
        origin: '',
        destination: '',
        passengers: '',
        tripDate: getVisibleFieldValue(form, 'airport_hotel_date'),
        tripTime: getVisibleFieldValue(form, 'airport_hotel_time')
      };
    }

    return {
      origin: typeof snapshot.origin === 'string' ? snapshot.origin.trim() : '',
      destination: typeof snapshot.destination === 'string' ? snapshot.destination.trim() : '',
      passengers: resolveAirportHotelPassengersLabel(),
      tripDate: typeof snapshot.serviceDate === 'string' && snapshot.serviceDate.trim()
        ? snapshot.serviceDate.trim()
        : getVisibleFieldValue(form, 'airport_hotel_date'),
      tripTime: typeof snapshot.serviceTime === 'string' && snapshot.serviceTime.trim()
        ? snapshot.serviceTime.trim()
        : getVisibleFieldValue(form, 'airport_hotel_time')
    };
  }

  function getTourPrivateEditorData(form) {
    if (!form) {
      return {
        tourLabel: '',
        passengers: '',
        pickup: '',
        tripDate: '',
        tripTime: '',
        hasGuide: '',
        guideLanguage: '',
        price: '',
        currency: ''
      };
    }

    return {
      tourLabel: getVisibleFieldValue(form, 'tour_private_tour_label'),
      passengers: getVisibleFieldValue(form, 'tour_private_passenger_bucket_label'),
      pickup: getVisibleFieldValue(form, 'tour_private_pickup'),
      tripDate: getVisibleFieldValue(form, 'tour_private_date'),
      tripTime: getVisibleFieldValue(form, 'tour_private_time'),
      hasGuide: getVisibleFieldValue(form, 'tour_private_has_guide'),
      guideLanguage: getVisibleFieldValue(form, 'tour_private_guide_language_label') || getVisibleFieldValue(form, 'tour_private_guide_language'),
      price: getVisibleFieldValue(form, 'tour_private_price'),
      currency: getVisibleFieldValue(form, 'tour_private_currency')
    };
  }
  
  function getHourlyDailyEditorData(form) {
  if (!form) {
    return {
      mode: '',
      pickup: '',
      tripDate: '',
      tripTime: '',
      durationHours: '',
      customTerm: '',
      price: '',
      currency: ''
    };
  }

  return {
    mode: getVisibleFieldValue(form, 'hourly_daily_mode'),
    pickup: getVisibleFieldValue(form, 'hourly_daily_pickup'),
    tripDate: getVisibleFieldValue(form, 'hourly_daily_date'),
    tripTime: getVisibleFieldValue(form, 'hourly_daily_start_time'),
    durationHours: getVisibleFieldValue(form, 'hourly_daily_duration_hours'),
    customTerm: getVisibleFieldValue(form, 'hourly_daily_custom_term'),
    price: getVisibleFieldValue(form, 'hourly_daily_price'),
    currency: getVisibleFieldValue(form, 'hourly_daily_currency')
  };
}

  function getEventSpecialEditorData(form) {
    if (!form) {
      return {
        eventLabel: '',
        venueLabel: '',
        variantLabel: '',
        originAddress: '',
        destinationAddress: '',
        originPickupTime: '',
        returnPickupTime: '',
        returnPickupLabel: '',
        estimatedEventArrivalTime: '',
        estimatedDestinationArrivalTime: '',
        passengers: '',
        price: '',
        currency: '',
        notes: ''
      };
    }

    return {
      eventLabel: getVisibleFieldValue(form, 'event_special_event_label'),
      venueLabel: getVisibleFieldValue(form, 'event_special_venue_label'),
      variantLabel: getVisibleFieldValue(form, 'event_special_variant_label'),
      originAddress: getVisibleFieldValue(form, 'event_special_origin_address'),
      destinationAddress: getVisibleFieldValue(form, 'event_special_destination_address'),
      originPickupTime: getVisibleFieldValue(form, 'event_special_origin_pickup_time'),
      returnPickupTime: getVisibleFieldValue(form, 'event_special_return_pickup_time'),
      returnPickupLabel: getVisibleFieldValue(form, 'event_special_return_pickup_label') ||
        getVisibleFieldValue(form, 'event_special_return_pickup_time'),
      estimatedEventArrivalTime: getVisibleFieldValue(form, 'event_special_estimated_event_arrival_time'),
      estimatedDestinationArrivalTime: getVisibleFieldValue(form, 'event_special_estimated_destination_arrival_time'),
      passengers: getVisibleFieldValue(form, 'event_special_passenger_bucket_label'),
      price: getVisibleFieldValue(form, 'event_special_price'),
      currency: getVisibleFieldValue(form, 'event_special_currency'),
      notes: getVisibleFieldValue(form, 'event_special_notes') || getVisibleFieldValue(form, 'message')
    };
  }
  
    function getDirectTransferEditorData(form) {
    if (!form) {
      return {
        originAddress: '',
        destinationAddress: '',
        tripDate: '',
        tripTime: '',
        passengers: '',
        vehicle: '',
        distanceMeters: '',
        durationSeconds: '',
        price: '',
        currency: '',
        notes: ''
      };
    }

    return {
      originAddress: getVisibleFieldValue(form, 'direct_transfer_origin_address'),
      destinationAddress: getVisibleFieldValue(form, 'direct_transfer_destination_address'),
      tripDate: getVisibleFieldValue(form, 'direct_transfer_date'),
      tripTime: getVisibleFieldValue(form, 'direct_transfer_time'),
      passengers: getVisibleFieldValue(form, 'direct_transfer_passenger_bucket_label'),
      vehicle: getVisibleFieldValue(form, 'direct_transfer_vehicle_label'),
      distanceMeters: getVisibleFieldValue(form, 'direct_transfer_distance_meters'),
      durationSeconds: getVisibleFieldValue(form, 'direct_transfer_duration_seconds'),
      price: getVisibleFieldValue(form, 'direct_transfer_price'),
      currency: getVisibleFieldValue(form, 'direct_transfer_currency'),
      notes: getVisibleFieldValue(form, 'direct_transfer_notes') || getVisibleFieldValue(form, 'message')
    };
  }

  function formatDirectTransferDistance(value) {
    var meters;
    var kilometers;
    var roundedKilometers;

    meters = Number(value);

    if (!Number.isFinite(meters) || meters <= 0) {
      return '';
    }

    kilometers = meters / 1000;
    roundedKilometers = kilometers >= 10
      ? Math.round(kilometers)
      : Math.round(kilometers * 10) / 10;

    return String(roundedKilometers).replace('.', ',') + ' km';
  }

  function formatDirectTransferDuration(value) {
    var seconds;

    seconds = Number(value);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return '';
    }

    return String(Math.max(1, Math.round(seconds / 60))) + ' min aprox.';
  }

  function getVisibleFormData(form) {
    var serviceType;
    var airportHotelData;
    var tourPrivateData;
    var hourlyDailyData;
    var eventSpecialData;
    var directTransferData;
    var fallbackOrigin;
    var fallbackDestination;
    var fallbackPassengers;

    serviceType = getVisibleFieldValue(form, 'service_type');
    fallbackOrigin = getVisibleFieldValue(form, 'origin');
    fallbackDestination = getVisibleFieldValue(form, 'destination');
    fallbackPassengers = getVisibleFieldValue(form, 'passengers');
    airportHotelData = serviceType === 'airport_hotel'
      ? getAirportHotelEditorData(form)
      : null;
    tourPrivateData = serviceType === 'tour_private'
      ? getTourPrivateEditorData(form)
      : null;
    hourlyDailyData = serviceType === 'hourly_daily'
      ? getHourlyDailyEditorData(form)
      : null;
    eventSpecialData = serviceType === 'event_special'
      ? getEventSpecialEditorData(form)
      : null;
    directTransferData = serviceType === 'direct_transfer'
      ? getDirectTransferEditorData(form)
      : null;

    return {
      name: getVisibleFieldValue(form, 'name'),
      phone: getVisibleFieldValue(form, 'phone'),
      email: getVisibleFieldValue(form, 'email'),
      tripDate: directTransferData && directTransferData.tripDate
        ? directTransferData.tripDate
        : (
            airportHotelData && airportHotelData.tripDate
              ? airportHotelData.tripDate
              : (
                  tourPrivateData && tourPrivateData.tripDate
                    ? tourPrivateData.tripDate
                    : (
                        hourlyDailyData && hourlyDailyData.tripDate
                          ? hourlyDailyData.tripDate
                          : getVisibleFieldValue(form, 'trip_date')
                      )
                )
          ),
      tripTime: directTransferData && directTransferData.tripTime
        ? directTransferData.tripTime
        : (
            airportHotelData && airportHotelData.tripTime
              ? airportHotelData.tripTime
              : (
                  tourPrivateData && tourPrivateData.tripTime
                    ? tourPrivateData.tripTime
                    : (
                        hourlyDailyData && hourlyDailyData.tripTime
                          ? hourlyDailyData.tripTime
                          : getVisibleFieldValue(form, 'trip_time')
                      )
                )
          ),
      origin: directTransferData && directTransferData.originAddress
        ? directTransferData.originAddress
        : (
            eventSpecialData && eventSpecialData.originAddress
              ? eventSpecialData.originAddress
              : (airportHotelData && airportHotelData.origin ? airportHotelData.origin : fallbackOrigin)
          ),
      destination: directTransferData && directTransferData.destinationAddress
        ? directTransferData.destinationAddress
        : (
            eventSpecialData && eventSpecialData.destinationAddress
              ? eventSpecialData.destinationAddress
              : (airportHotelData && airportHotelData.destination ? airportHotelData.destination : fallbackDestination)
          ),
      serviceType: serviceType,
      zone: getVisibleFieldValue(form, 'zone'),
      fare: getVisibleFieldValue(form, 'fare'),
      passengers: directTransferData && directTransferData.passengers
        ? directTransferData.passengers
        : (
            eventSpecialData && eventSpecialData.passengers
              ? eventSpecialData.passengers
              : (
                  airportHotelData && airportHotelData.passengers
                    ? airportHotelData.passengers
                    : (tourPrivateData && tourPrivateData.passengers ? tourPrivateData.passengers : fallbackPassengers)
                )
          ),
      luggage: getVisibleFieldValue(form, 'luggage'),
      notes: directTransferData && directTransferData.notes
        ? directTransferData.notes
        : (
            eventSpecialData && eventSpecialData.notes
              ? eventSpecialData.notes
              : (
                  hourlyDailyData && hourlyDailyData.mode
                    ? (getVisibleFieldValue(form, 'hourly_daily_notes') || getVisibleFieldValue(form, 'message'))
                    : getVisibleFieldValue(form, 'message')
                )
          ),
      tourLabel: tourPrivateData && tourPrivateData.tourLabel ? tourPrivateData.tourLabel : '',
      pickup: tourPrivateData && tourPrivateData.pickup ? tourPrivateData.pickup : '',
      hasGuide: tourPrivateData && tourPrivateData.hasGuide ? tourPrivateData.hasGuide : '',
      guideLanguage: tourPrivateData && tourPrivateData.guideLanguage ? tourPrivateData.guideLanguage : '',
      price: directTransferData && directTransferData.price
        ? directTransferData.price
        : (
            eventSpecialData && eventSpecialData.price
              ? eventSpecialData.price
              : (
                  tourPrivateData && tourPrivateData.price
                    ? tourPrivateData.price
                    : (hourlyDailyData && hourlyDailyData.price ? hourlyDailyData.price : '')
                )
          ),
      currency: directTransferData && directTransferData.currency
        ? directTransferData.currency
        : (
            eventSpecialData && eventSpecialData.currency
              ? eventSpecialData.currency
              : (
                  tourPrivateData && tourPrivateData.currency
                    ? tourPrivateData.currency
                    : (hourlyDailyData && hourlyDailyData.currency ? hourlyDailyData.currency : '')
                )
          ),
      hourlyDailyMode: hourlyDailyData && hourlyDailyData.mode ? hourlyDailyData.mode : '',
      hourlyDailyPickup: hourlyDailyData && hourlyDailyData.pickup ? hourlyDailyData.pickup : '',
      hourlyDailyDurationHours: hourlyDailyData && hourlyDailyData.durationHours ? hourlyDailyData.durationHours : '',
      hourlyDailyCustomTerm: hourlyDailyData && hourlyDailyData.customTerm ? hourlyDailyData.customTerm : '',
      eventSpecialEventLabel: eventSpecialData && eventSpecialData.eventLabel ? eventSpecialData.eventLabel : '',
      eventSpecialVenueLabel: eventSpecialData && eventSpecialData.venueLabel ? eventSpecialData.venueLabel : '',
      eventSpecialVariantLabel: eventSpecialData && eventSpecialData.variantLabel ? eventSpecialData.variantLabel : '',
      eventSpecialOriginPickupTime: eventSpecialData && eventSpecialData.originPickupTime ? eventSpecialData.originPickupTime : '',
      eventSpecialReturnPickupLabel: eventSpecialData && eventSpecialData.returnPickupLabel ? eventSpecialData.returnPickupLabel : '',
      eventSpecialEstimatedEventArrivalTime: eventSpecialData && eventSpecialData.estimatedEventArrivalTime ? eventSpecialData.estimatedEventArrivalTime : '',
      eventSpecialEstimatedDestinationArrivalTime: eventSpecialData && eventSpecialData.estimatedDestinationArrivalTime ? eventSpecialData.estimatedDestinationArrivalTime : '',
      directTransferVehicle: directTransferData && directTransferData.vehicle ? directTransferData.vehicle : '',
      directTransferDistance: directTransferData && directTransferData.distanceMeters ? formatDirectTransferDistance(directTransferData.distanceMeters) : '',
      directTransferDuration: directTransferData && directTransferData.durationSeconds ? formatDirectTransferDuration(directTransferData.durationSeconds) : ''
    };
  }
  
  function buildMessageLines(data) {
    var lines;
    var labels;
    var guideValue;

    labels = {
      intro: getI18nValue('contact.whatsappMessage.intro', 'Hola, quiero solicitar un traslado con Pixkuy.'),
      serviceType: getI18nValue('contact.whatsappMessage.serviceType', 'Tipo de servicio'),
      serviceAirportHotel: getI18nValue('contact.services.airportHotel', 'Aeropuerto y hotel'),
      serviceTourPrivate: getI18nValue('contact.services.tourPrivate', 'Tours y visitas privadas'),
      serviceHourlyDaily: getI18nValue('contact.services.hourlyDaily', 'Por horas o por día'),
      serviceEventSpecial: getI18nValue('contact.services.eventSpecial.label', 'Eventos y ocasiones especiales'),
      serviceDirectTransfer: getI18nValue('directTransferMobileFlow.whatsapp.serviceLabel', 'Traslado directo'),
      serviceOther: getI18nValue('contact.services.other', 'Otro servicio'),
      name: getI18nValue('contact.whatsappMessage.name', 'Nombre'),
      phone: getI18nValue('contact.whatsappMessage.phone', 'Teléfono'),
      email: getI18nValue('contact.whatsappMessage.email', 'Correo electrónico'),
      tripDate: getI18nValue('contact.whatsappMessage.tripDate', 'Fecha del traslado'),
      tripTime: getI18nValue('contact.whatsappMessage.tripTime', 'Hora del traslado'),
      origin: getI18nValue('contact.whatsappMessage.origin', 'Origen'),
      destination: getI18nValue('contact.whatsappMessage.destination', 'Destino'),
      zone: getI18nValue('contact.whatsappMessage.zone', 'Zona'),
      fare: getI18nValue('contact.whatsappMessage.fare', 'Tarifa'),
      passengers: getI18nValue('contact.whatsappMessage.passengers', 'Pasajeros'),
      luggage: getI18nValue('contact.whatsappMessage.luggage', 'Maletas'),
      notes: getI18nValue('contact.whatsappMessage.notes', 'Notas'),
      tour: getI18nValue('contact.whatsappMessage.tour', 'Tour'),
      pickup: getI18nValue('contact.whatsappMessage.pickup', 'Recogida'),
      guide: getI18nValue('contact.whatsappMessage.guide', 'Guía'),
      guideLanguage: getI18nValue('contact.whatsappMessage.guideLanguage', 'Idioma del guía'),
      price: getI18nValue('contact.whatsappMessage.price', 'Precio final'),
      yes: getI18nValue('ui.yes', 'Sí'),
      no: getI18nValue('ui.no', 'No'),
      hourlyDailyMode: getI18nValue('services.cards.hourly.panel.modeLabel', 'Modalidad'),
      hourlyDailyDuration: getI18nValue('services.cards.hourly.panel.durationLabel', 'Duración'),
      hourlyDailyLongTerm: getI18nValue('services.cards.hourly.panel.longTermDurationLabel', 'Periodo solicitado'),
      hourlyTabHourly: getI18nValue('services.cards.hourly.panel.tabs.hourly', 'Por horas'),
      hourlyTabFullDay: getI18nValue('services.cards.hourly.panel.tabs.fullDay', 'Día completo'),
      hourlyTabLongTerm: getI18nValue('services.cards.hourly.panel.tabs.longTerm', 'Planes largos'),
      hourlyLongTermWeek: getI18nValue('services.cards.hourly.panel.longTerm.week', 'Semana'),
      hourlyLongTermFortnight: getI18nValue('services.cards.hourly.panel.longTerm.fortnight', '15 días'),
      hourlyLongTermMonthly: getI18nValue('services.cards.hourly.panel.longTerm.monthly', 'Mensual'),
      hourlyLongTermCustom: getI18nValue('services.cards.hourly.panel.longTerm.custom', 'Otro periodo'),
      event: getI18nValue('contact.services.eventSpecial.eventLabel', 'Evento'),
      venue: getI18nValue('contact.services.eventSpecial.venueLabel', 'Recinto'),
      variant: getI18nValue('contact.services.eventSpecial.variantLabel', 'Modalidad'),
      originPickupTime: getI18nValue('contact.services.eventSpecial.originPickupTimeLabel', 'Hora de recogida en origen'),
      returnPickupTime: getI18nValue('contact.services.eventSpecial.returnPickupTimeLabel', 'Hora recogida tras evento'),
      estimatedEventArrival: getI18nValue('contact.services.eventSpecial.estimatedEventArrivalLabel', 'Llegada al evento estimada'),
      estimatedDestinationArrival: getI18nValue('contact.services.eventSpecial.estimatedDestinationArrivalLabel', 'Llegada a destino estimada'),
      vehicle: getI18nValue('directTransferMobileFlow.contactStep.summary.vehicle', 'Vehículo'),
      distance: 'Distancia',
      duration: 'Tiempo estimado'
    };

    lines = [labels.intro];

    if (data.serviceType === 'airport_hotel') {
      lines.push(labels.serviceType + ': ' + labels.serviceAirportHotel);
    } else if (data.serviceType === 'tour_private') {
      lines.push(labels.serviceType + ': ' + labels.serviceTourPrivate);
    } else if (data.serviceType === 'hourly_daily') {
      lines.push(labels.serviceType + ': ' + labels.serviceHourlyDaily);
    } else if (data.serviceType === 'event_special') {
      lines.push(labels.serviceType + ': ' + labels.serviceEventSpecial);
    } else if (data.serviceType === 'direct_transfer') {
      lines.push(labels.serviceType + ': ' + labels.serviceDirectTransfer);
    } else if (data.serviceType === 'other') {
      lines.push(labels.serviceType + ': ' + labels.serviceOther);
    }

    if (data.name) {
      lines.push(labels.name + ': ' + data.name);
    }

    if (data.phone) {
      lines.push(labels.phone + ': ' + data.phone);
    }

    if (data.email) {
      lines.push(labels.email + ': ' + data.email);
    }

    if (data.tripDate) {
      lines.push(labels.tripDate + ': ' + data.tripDate);
    }

    if (data.tripTime) {
      lines.push(labels.tripTime + ': ' + data.tripTime);
    }

    if (data.origin) {
      lines.push(labels.origin + ': ' + data.origin);
    }

    if (data.destination) {
      lines.push(labels.destination + ': ' + data.destination);
    }

    if (data.zone) {
      lines.push(labels.zone + ': ' + data.zone);
    }

    if (data.fare) {
      lines.push(labels.fare + ': ' + data.fare);
    }

    if (data.tourLabel) {
      lines.push(labels.tour + ': ' + data.tourLabel);
    }

    if (data.pickup) {
      lines.push(labels.pickup + ': ' + data.pickup);
    }
	
	    if (data.serviceType === 'event_special' && data.eventSpecialEventLabel) {
      lines.push(labels.event + ': ' + data.eventSpecialEventLabel);
    }

    if (data.serviceType === 'event_special' && data.eventSpecialVenueLabel) {
      lines.push(labels.venue + ': ' + data.eventSpecialVenueLabel);
    }

    if (data.serviceType === 'event_special' && data.eventSpecialVariantLabel) {
      lines.push(labels.variant + ': ' + data.eventSpecialVariantLabel);
    }

    if (data.serviceType === 'event_special' && data.eventSpecialOriginPickupTime) {
      lines.push(labels.originPickupTime + ': ' + data.eventSpecialOriginPickupTime);
    }

    if (data.serviceType === 'event_special' && data.eventSpecialReturnPickupLabel) {
      lines.push(labels.returnPickupTime + ': ' + data.eventSpecialReturnPickupLabel);
    }

    if (data.serviceType === 'event_special' && data.eventSpecialEstimatedEventArrivalTime) {
      lines.push(labels.estimatedEventArrival + ': ' + data.eventSpecialEstimatedEventArrivalTime);
    }

    if (data.serviceType === 'event_special' && data.eventSpecialEstimatedDestinationArrivalTime) {
      lines.push(labels.estimatedDestinationArrival + ': ' + data.eventSpecialEstimatedDestinationArrivalTime);
    }
	
	if (data.serviceType === 'hourly_daily' && data.hourlyDailyMode) {
      if (data.hourlyDailyMode === 'hourly') {
        lines.push(labels.hourlyDailyMode + ': ' + labels.hourlyTabHourly);
      } else if (data.hourlyDailyMode === 'full_day') {
        lines.push(labels.hourlyDailyMode + ': ' + labels.hourlyTabFullDay);
      } else if (data.hourlyDailyMode === 'custom_long_term') {
        lines.push(labels.hourlyDailyMode + ': ' + labels.hourlyTabLongTerm);
      }
    }

    if (data.serviceType === 'hourly_daily' && data.hourlyDailyPickup) {
      lines.push(labels.pickup + ': ' + data.hourlyDailyPickup);
    }

    if (data.serviceType === 'hourly_daily' && data.hourlyDailyDurationHours) {
      lines.push(labels.hourlyDailyDuration + ': ' + data.hourlyDailyDurationHours + 'h');
    }

    if (data.serviceType === 'hourly_daily' && data.hourlyDailyCustomTerm) {
      if (data.hourlyDailyCustomTerm === 'week') {
        lines.push(labels.hourlyDailyLongTerm + ': ' + labels.hourlyLongTermWeek);
      } else if (data.hourlyDailyCustomTerm === 'fortnight') {
        lines.push(labels.hourlyDailyLongTerm + ': ' + labels.hourlyLongTermFortnight);
      } else if (data.hourlyDailyCustomTerm === 'monthly') {
        lines.push(labels.hourlyDailyLongTerm + ': ' + labels.hourlyLongTermMonthly);
      } else if (data.hourlyDailyCustomTerm === 'custom') {
        lines.push(labels.hourlyDailyLongTerm + ': ' + labels.hourlyLongTermCustom);
      }
    }

    if (data.serviceType === 'direct_transfer' && data.directTransferVehicle) {
      lines.push(labels.vehicle + ': ' + data.directTransferVehicle);
    }

    if (data.serviceType === 'direct_transfer' && data.directTransferDistance) {
      lines.push(labels.distance + ': ' + data.directTransferDistance);
    }

    if (data.serviceType === 'direct_transfer' && data.directTransferDuration) {
      lines.push(labels.duration + ': ' + data.directTransferDuration);
    }

    if (data.passengers) {
      lines.push(labels.passengers + ': ' + data.passengers);
    }

    if (data.serviceType === 'tour_private' && data.hasGuide) {
      guideValue = data.hasGuide === 'true' ? labels.yes : labels.no;
      lines.push(labels.guide + ': ' + guideValue);
    }

    if (data.guideLanguage) {
      lines.push(labels.guideLanguage + ': ' + data.guideLanguage);
    }

    if (data.price) {
      lines.push(labels.price + ': ' + data.price + (data.currency ? ' ' + data.currency : ''));
    }

    if (data.luggage) {
      lines.push(labels.luggage + ': ' + data.luggage);
    }

    if (data.notes) {
      lines.push(labels.notes + ': ' + data.notes);
    }

    return lines;
  }

  function getWhatsappPhoneNumber() {
    var parts;

    parts = [
      '52',
      '1',
      '55',
      '2883',
      '7400'
    ];

    return parts.join('').replace(/[^\d]/g, '');
  }

  function buildWhatsappUrl(phoneNumber, message) {
    var normalizedPhone;
    var encodedMessage;

    normalizedPhone = String(phoneNumber || '').replace(/[^\d]/g, '');
    encodedMessage = encodeURIComponent(message || '');

    if (!normalizedPhone) {
      return '';
    }

    return 'https://wa.me/' + normalizedPhone + '?text=' + encodedMessage;
  }

  function updateWhatsappLink(link, form) {
    var data;
    var message;
    var url;
    var phoneNumber;
    var mode;

    if (!link || !form) {
      return '';
    }

    link.setAttribute(
      'aria-label',
      getI18nValue('contact.whatsappCta', 'Hablar por WhatsApp')
    );

    phoneNumber = getWhatsappPhoneNumber();
    mode = link.getAttribute('data-contact-whatsapp-mode');

    if (mode === 'general') {
      message = getI18nValue(
        'contact.whatsappMessage.generalIntro',
        getI18nValue('contact.whatsappMessage.intro', '')
      );
    } else {
      data = getVisibleFormData(form);
      message = buildMessageLines(data).join('\n');
    }

    url = buildWhatsappUrl(phoneNumber, message);

    if (url) {
      link.setAttribute('href', url);
    } else {
      link.setAttribute('href', '#contact');
    }

    return url;
  }

  function bindWhatsappLink(link, form) {
    if (!link || !form) {
      return false;
    }

    updateWhatsappLink(link, form);

    form.addEventListener('input', function () {
      updateWhatsappLink(link, form);
    });

    form.addEventListener('change', function () {
      updateWhatsappLink(link, form);
    });

    window.addEventListener('pixkuy:i18n-applied', function () {
      updateWhatsappLink(link, form);
    });

    link.addEventListener('click', function (event) {
      var url = updateWhatsappLink(link, form);
      var target;

      event.preventDefault();

      if (!url) {
        return;
      }

      target = link.getAttribute('target');

      if (target === '_blank') {
        window.open(url, '_blank', 'noopener');
        return;
      }

      window.location.href = url;
    });

    return true;
  }
  
  function initWhatsappHandoff() {
    var form;
    var links;
    var i;
    var hasBoundLink;

    form = getContactForm();
    links = document.querySelectorAll('[data-contact-whatsapp="1"]');
    hasBoundLink = false;

    if (!form || !links.length) {
      return false;
    }

    for (i = 0; i < links.length; i += 1) {
      hasBoundLink = bindWhatsappLink(links[i], form) || hasBoundLink;
    }

    return hasBoundLink;
  }

  if (!window.PixkuyForms) {
    window.PixkuyForms = {};
  }

  window.PixkuyForms.initWhatsappHandoff = initWhatsappHandoff;
})(window, document);