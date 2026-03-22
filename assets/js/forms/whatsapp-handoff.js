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

  function getVisibleFormData(form) {
    return {
      name: getVisibleFieldValue(form, 'name'),
      phone: getVisibleFieldValue(form, 'phone'),
      email: getVisibleFieldValue(form, 'email'),
      tripDate: getVisibleFieldValue(form, 'trip_date'),
      tripTime: getVisibleFieldValue(form, 'trip_time'),
      origin: getVisibleFieldValue(form, 'origin'),
      destination: getVisibleFieldValue(form, 'destination'),
      passengers: getVisibleFieldValue(form, 'passengers'),
      luggage: getVisibleFieldValue(form, 'luggage'),
      notes: getVisibleFieldValue(form, 'message')
    };
  }

  function buildMessageLines(data) {
    var lines;
    var labels;

    labels = {
      intro: getI18nValue('contact.whatsappMessage.intro', 'Hola, quiero solicitar un traslado con Pixkuy.'),
      name: getI18nValue('contact.whatsappMessage.name', 'Nombre'),
      phone: getI18nValue('contact.whatsappMessage.phone', 'Teléfono'),
      email: getI18nValue('contact.whatsappMessage.email', 'Correo electrónico'),
      tripDate: getI18nValue('contact.whatsappMessage.tripDate', 'Fecha del traslado'),
      tripTime: getI18nValue('contact.whatsappMessage.tripTime', 'Hora del traslado'),
      origin: getI18nValue('contact.whatsappMessage.origin', 'Origen'),
      destination: getI18nValue('contact.whatsappMessage.destination', 'Destino'),
      passengers: getI18nValue('contact.whatsappMessage.passengers', 'Pasajeros'),
      luggage: getI18nValue('contact.whatsappMessage.luggage', 'Maletas'),
      notes: getI18nValue('contact.whatsappMessage.notes', 'Notas')
    };

    lines = [labels.intro];

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

    if (data.passengers) {
      lines.push(labels.passengers + ': ' + data.passengers);
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

      if (!url) {
        event.preventDefault();
      }
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