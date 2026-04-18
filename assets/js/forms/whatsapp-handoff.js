(function (window, document) {
  'use strict';

  function getI18nValue(path, fallback) {
    var i18n;
    var parts;
    var value;
    var i;

    i18n = window.PixkuyI18n;
    value = i18n && i18n.currentCopy;
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

  function getVisibleFormData(form) {
    var serviceType;
    var airportHotelData;
    var tourPrivateData;
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

    return {
      name: getVisibleFieldValue(form, 'name'),
      phone: getVisibleFieldValue(form, 'phone'),
      email: getVisibleFieldValue(form, 'email'),
      tripDate: airportHotelData && airportHotelData.tripDate
        ? airportHotelData.tripDate
        : (tourPrivateData && tourPrivateData.tripDate ? tourPrivateData.tripDate : getVisibleFieldValue(form, 'trip_date')),
      tripTime: airportHotelData && airportHotelData.tripTime
        ? airportHotelData.tripTime
        : (tourPrivateData && tourPrivateData.tripTime ? tourPrivateData.tripTime : getVisibleFieldValue(form, 'trip_time')),
      origin: airportHotelData && airportHotelData.origin ? airportHotelData.origin : fallbackOrigin,
      destination: airportHotelData && airportHotelData.destination ? airportHotelData.destination : fallbackDestination,
      serviceType: serviceType,
      zone: getVisibleFieldValue(form, 'zone'),
      fare: getVisibleFieldValue(form, 'fare'),
      passengers: airportHotelData && airportHotelData.passengers
        ? airportHotelData.passengers
        : (tourPrivateData && tourPrivateData.passengers ? tourPrivateData.passengers : fallbackPassengers),
      luggage: getVisibleFieldValue(form, 'luggage'),
      notes: getVisibleFieldValue(form, 'message'),
      tourLabel: tourPrivateData && tourPrivateData.tourLabel ? tourPrivateData.tourLabel : '',
      pickup: tourPrivateData && tourPrivateData.pickup ? tourPrivateData.pickup : '',
      hasGuide: tourPrivateData && tourPrivateData.hasGuide ? tourPrivateData.hasGuide : '',
      guideLanguage: tourPrivateData && tourPrivateData.guideLanguage ? tourPrivateData.guideLanguage : '',
      price: tourPrivateData && tourPrivateData.price ? tourPrivateData.price : '',
      currency: tourPrivateData && tourPrivateData.currency ? tourPrivateData.currency : ''
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
      price: getI18nValue('contact.whatsappMessage.price', 'Precio final')
    };

    lines = [labels.intro];

    if (data.serviceType === 'airport_hotel') {
      lines.push(labels.serviceType + ': ' + labels.serviceAirportHotel);
    } else if (data.serviceType === 'tour_private') {
      lines.push(labels.serviceType + ': ' + labels.serviceTourPrivate);
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

    if (data.passengers) {
      lines.push(labels.passengers + ': ' + data.passengers);
    }

    if (data.serviceType === 'tour_private' && data.hasGuide) {
      guideValue = data.hasGuide === 'true' ? 'Sí' : 'No';
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

    if (!link || !form) {
      return '';
    }

    phoneNumber = getWhatsappPhoneNumber();
    data = getVisibleFormData(form);
    message = buildMessageLines(data).join('\n');
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
    var link;

    form = getContactForm();
    link = document.querySelector('[data-contact-whatsapp="1"]');

    if (!form || !link) {
      return false;
    }

    return bindWhatsappLink(link, form);
  }

  if (!window.PixkuyForms) {
    window.PixkuyForms = {};
  }

  window.PixkuyForms.initWhatsappHandoff = initWhatsappHandoff;
})(window, document);