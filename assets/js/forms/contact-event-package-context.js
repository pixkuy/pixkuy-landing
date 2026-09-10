(function (window, document) {
  'use strict';
  // Adapter only: selection, quote, idempotency and receipt remain owned by packages.
  const C = window.PixkuyEventPackagesState;
  const view = () => window.PixkuyEventPackagesConfig;
  const request = () => window.PixkuyEventPackagesRequest;
  let active = false;
  let form = null;
  let root = null;
  let legacy = null;
  let configurationHost = null;
  let configurationRoot = null;
  let summaryHost = null;
  let statusHost = null;
  let whatsappHidden = false;
  let confirmedReference = '';
  let summaryMarkup = '';
  const confirmationFields = new Set();
  const boundForms = new WeakSet();

  const selectedContext = () => window.PixkuyForms?.getContactEventSelection?.();
  function isActive() {
    return active && selectedContext()?.offerKind === 'packages' &&
      window.PixkuyForms.contactServiceState.getActiveServiceType() === 'event_special';
  }
  function matchesSelection() {
    const selected = selectedContext();
    return selected?.available && selected.eventId === C.state.selectedEvent?.id && C.state.catalogStatus === 'ready' &&
      C.state.events.some(event=>event.id===selected.eventId&&event.publicationVersion===C.state.selectedEvent.publicationVersion);
  }
  function canSubmit() {
    const state = C.state;
    if (!isActive() || !matchesSelection() || state.receipt || state.requestStatus === 'submitting') return false;
    if (request().hasFrozenBody()) return state.requestStatus === 'unknown' || state.requestStatus === 'error';
    return Boolean(state.configurationSurface === 'contact' && state.screen === 'contact' && state.selection && state.quoteStatus === 'ready' &&
      state.quote?.source === 'published' && /^[a-f0-9]{64}$/.test(state.quote.quoteFingerprint) &&
      state.selection.publicationVersion === state.selectedEvent?.publicationVersion &&
      state.quote.calculation.coverageStatus !== 'outside' &&
      !(state.quote.calculation.serviceLines || []).some(line => line.included?.quoteExpiresAt &&
        Date.parse(line.included.quoteExpiresAt) <= Date.now()));
  }
  function contactFields() {
    return ['name', 'phone', 'email'].map(name => [name, form.querySelector('#contact-' + name)]);
  }
  function syncContact() {
    if (!isActive() || !matchesSelection() || !C.state.selection || request().hasFrozenBody()) return;
    contactFields().forEach(([name, input]) => { if (input) C.state.contact[name] = input.value; });
  }
  function syncConfirmationFields(confirmed) {
    if (!confirmed) {
      confirmationFields.forEach(node => node.removeAttribute('data-package-confirmed-field'));
      confirmationFields.clear();
      return;
    }
    // Scope visibility to this active receipt; never change shared field values.
    ['name', 'phone', 'email', 'message', 'submit'].forEach(name => {
      const input = form.querySelector('#contact-' + name);
      const field = input?.closest(name === 'submit' ? '.form-actions' : '.form-field');
      if (field) { field.setAttribute('data-package-confirmed-field', ''); confirmationFields.add(field); }
    });
    const footer = form.parentElement?.querySelector('[data-i18n="contact.footer"]');
    if (footer) { footer.setAttribute('data-package-confirmed-field', ''); confirmationFields.add(footer); }
  }
  function update() {
    if (!isActive() || !root) return;
    const state = C.state;
    const config = view();
    const t = config.t;
    const locked = request().hasFrozenBody() || state.requestStatus === 'submitting' || !!state.receipt;
    const matched = matchesSelection();
    // The configuration host reuses the original renderer. Summary updates never
    // remount Places, the selector or the shared contact fields.
    configurationHost.hidden = !!state.receipt || !matched || state.screen !== 'config';
    const nextMarkup = state.receipt ? config.receiptContent(state) : matched && state.selection && state.screen === 'contact' ? config.contactSummary(state) : '';
    if (summaryMarkup !== nextMarkup) { summaryHost.innerHTML = nextMarkup; summaryMarkup = nextMarkup; }
    syncConfirmationFields(!!state.receipt);
    if (state.receipt && confirmedReference !== state.receipt.reference) {
      confirmedReference = state.receipt.reference;
      const heading = summaryHost.querySelector('[data-package-confirmation-title]');
      heading?.focus({preventScroll:true});
      heading?.scrollIntoView({block:'start',behavior:'auto'});
    }
    root.querySelectorAll('[data-package-action="edit-services"]').forEach(button => { button.disabled = locked; });
    contactFields().forEach(([, input]) => { if (input) input.readOnly = locked; });
    const message = document.createElement('p');
    message.className = 'events-package-help';
    message.setAttribute('role', 'status');
    message.textContent = state.receipt ? '' : !matched ? t('eventUnavailable') : state.requestStatus === 'submitting' ? t('sending') : state.requestStatus === 'unknown' ? t('unknownReception') : state.error ?
      t(/PUBLICATION|QUOTE/.test(state.error) ? 'reviewChanged' : 'error') :
      !state.storageAvailable ? t('storageWarning') : state.recoveryNotice ? t('recoveryNotice') :
      !state.receipt && state.screen === 'contact' && !canSubmit() && state.requestStatus !== 'submitting' ? t('reviewChanged') : '';
    statusHost.replaceChildren(message);
    if (!state.receipt && (state.recoveryNotice || state.requestStatus === 'unknown')) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'events-package-button events-package-button--secondary';
      button.setAttribute('data-package-action', 'recover'); button.textContent = t('recover'); statusHost.appendChild(button);
    }
    const fields = window.PixkuyForms?.getReservationRequestFields(form);
    if (fields) window.PixkuyForms.syncReservationRequestState(fields);
    const submit = form.querySelector('#contact-submit');
    if (submit) {
      if (!canSubmit()) submit.disabled = true;
      submit.textContent = t(state.receipt ? 'confirmationTitle' : state.requestStatus === 'submitting' ? 'sending' : request().hasFrozenBody() ? 'retry' : 'submit');
    }
  }
  function deactivate() {
    if (!active) return;
    syncContact(); active = false;
    syncConfirmationFields(false);
    confirmedReference = '';
    if (root) root.hidden = true;
    contactFields().forEach(([, input]) => { if (input) input.readOnly = false; });
    const whatsapp = form.querySelector('[data-contact-handoff="whatsapp"]');
    if (whatsapp) whatsapp.hidden = whatsappHidden;
    C.suspendQuote();
  }
  function reconcile() {
    const selected = selectedContext();
    const category = window.PixkuyForms?.contactServiceState?.getActiveServiceType();
    if (selected?.offerKind !== 'packages' || category !== 'event_special') { deactivate(); return false; }
    form = window.PixkuyForms.getReservationForm();
    if (!form) return false;
    legacy = form.querySelector('[data-contact-event-special-editor]');
    if (!legacy) return false;
    const entering = !active;
    active = true;
    if (!root) {
      root = document.createElement('section'); root.className = 'contact-event-package-context';
      root.setAttribute('data-contact-event-package-context', ''); legacy.after(root);
      configurationHost = document.createElement('div'); summaryHost = document.createElement('div'); statusHost = document.createElement('div');
      root.appendChild(configurationHost); root.appendChild(summaryHost); root.appendChild(statusHost);
      root.addEventListener('click', event => {
        if (configurationHost.contains(event.target)) return;
        const button = event.target.closest('[data-package-action]');
        if (!button || button.disabled) return;
        const action = button.getAttribute('data-package-action');
        if (action === 'edit-services') { syncContact(); C.state.configurationSurface = 'contact'; C.go('services'); configurationRoot?.scrollIntoView({block:'nearest'}); }
        else if (action === 'recover') void request().recover();
        else if (action === 'new') {
          if (!C.state.receipt) return;
          const eventId = C.state.receipt.eventId || C.state.selectedEvent?.id;
          request().newKnownRequest();
          const event = C.state.events.find(item => item.id === eventId);
          if (event) { C.state.configurationSurface = 'contact'; C.selectEvent(event, !event.snapshot.packages.some(pkg => pkg.active !== false)); }
          confirmedReference = ''; reconcile();
        }
        else if (action === 'copy-reference') void view().copyReference(button, C.state.receipt);
        else if (action === 'whatsapp') { const url = request().whatsappUrl(C.state.receipt); if (url) window.open(url, '_blank', 'noopener,noreferrer'); }
      });
    }
    if (entering) {
      const whatsapp = form.querySelector('[data-contact-handoff="whatsapp"]');
      if (whatsapp) { whatsappHidden = whatsapp.hidden; whatsapp.hidden = true; }
    }
    root.hidden = false;
    contactFields().forEach(([name, input]) => { if (input && !input.value && C.state.contact[name]) input.value = C.state.contact[name]; });
    syncContact();
    if (!boundForms.has(form)) {
      boundForms.add(form);
      form.addEventListener('input', syncContact);
      form.addEventListener('change', syncContact);
      form.addEventListener('pixkuy:contact-service-change', reconcile);
    }
    if (!configurationRoot) configurationRoot = view().mount(configurationHost, 'contact');
    if (entering && matchesSelection() && C.state.quoteStatus === 'ready' && !view().quoteIsCurrent(C.state) && C.state.screen === 'contact' && !request().hasFrozenBody()) C.change(()=>{});
    view().renderContact(configurationRoot);
    update(); return true;
  }
  function activate(target) {
    if (!C.state.selection || C.state.screen !== 'contact' || C.state.quoteStatus !== 'ready') return false;
    form = target;
    C.state.configurationSurface = 'contact';
    if (!window.PixkuyForms.selectContactPackageEvent(C.state.selectedEvent.id)) return false;
    return reconcile();
  }
  async function submit(fields) {
    if (!canSubmit() || window.PixkuyForms.isReservationRequestFormLocked(form) ||
      !window.PixkuyForms.refreshReservationRequestValidationUX(fields)) return false;
    syncContact();
    await request().submit();
    return true;
  }
  C.subscribe(update);
  window.addEventListener('pixkuy:i18n-applied', update);
  window.PixkuyEventPackagesContact = { activate, deactivate, reconcile, matchesSelection, isActive, canSubmit, submit };
})(window, document);
