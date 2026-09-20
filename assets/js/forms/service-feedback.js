(function () {
  'use strict';
  const modules = window.__pixkuyI18nModules;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const preview = fragment.has('preview');
  const previewNonce = fragment.get('preview') || '';
  let previewOrigin = '';
  try { const parent = new URL(fragment.get('parent')); if (/^https?:$/.test(parent.protocol) && parent.origin === fragment.get('parent')) previewOrigin = parent.origin; } catch { /* fail closed */ }
  const token = preview ? '' : fragment.get('t') || '';
  let previewFingerprint = '';
  function tellPreview(type) {
    if (!preview || !previewOrigin || window.parent === window) return;
    const message = {type, nonce: previewNonce};
    // Availability must not wait for offscreen animation/layout callbacks.
    if (type === 'pixkuy-feedback-preview-height') message.height = document.documentElement.scrollHeight;
    window.parent.postMessage(message, previewOrigin);
  }
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  const content = document.getElementById('survey-content');
  const notice = document.getElementById('survey-notice');
  const error = document.getElementById('survey-error');
  if (!modules || !['initLangSelector', 'loadRequiredFragment', 'loadTranslationsForLang'].every(name => typeof modules[name] === 'function')) {
    notice.textContent = '';
    const title = document.createElement('h1'); title.textContent = 'No se pudo cargar / Unable to load';
    const body = document.createElement('p'); body.textContent = 'Compruebe su conexión y vuelva a intentarlo. / Check your connection and try again.';
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Volver a intentar / Try again';
    retry.addEventListener('click', () => window.location.replace(window.location.pathname + window.location.search + '#' + fragment.toString()));
    content.append(title, body, retry); return;
  }
  let availableLocales = [];
  function setAvailableLocales(locales) {
    availableLocales = locales.map(item => item.code);
    document.querySelectorAll('.lang-menu [data-lang]').forEach(button => {
      button.closest('li').hidden = !availableLocales.includes(button.dataset.lang);
    });
  }
  // Use the public shell's selector and viewport-based topbar, including inside
  // Admin's iframe. Only this renderer's available languages are constrained.
  modules.initLangSelector(value => { if (context && availableLocales.includes(value)) void choose(value); });
  function headerHeight() {
    const header = document.querySelector(matchMedia('(max-width: 720px)').matches ? '.mobile-topbar' : '.legal-page-header');
    return header?.getBoundingClientRect().height || 0;
  }
  function syncHeaderHeight() { document.documentElement.style.setProperty('--survey-header-height', headerHeight() + 'px'); }
  window.addEventListener('resize', syncHeaderHeight);
  if (typeof ResizeObserver === 'function') document.querySelectorAll('.mobile-topbar, .legal-page-header').forEach(header => new ResizeObserver(syncHeaderHeight).observe(header));
  syncHeaderHeight();
  document.addEventListener('focusin', event => {
    if (!event.target.closest?.('.survey-main')) return;
    requestAnimationFrame(() => {
      const rect = event.target.getBoundingClientRect(), top = headerHeight() + 12;
      if (rect.top < top) window.scrollBy({ top: rect.top - top, behavior: 'instant' });
    });
  });
  const answers = new Map();
  const expanded = new Set();
  let requestedContact = false, context = null, locale = '', ui = null, sequence = 0, pending = false;
  let commandKey = null, submission = null, contactRecorded = false;
  const mobileForm = matchMedia('(max-width: 759px)');
  // Presentation changes reuse the same answers, expansion preferences and focus.
  mobileForm.addEventListener('change', () => { if (context && ui) render(); });
  function newCommandKey() {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    if (typeof globalThis.crypto?.getRandomValues !== 'function') throw new Error('SECURE_RANDOM_UNAVAILABLE');
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  async function bounded(promise) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('LOAD_TIMEOUT')), 15000); })]); }
    finally { clearTimeout(timer); }
  }
  function lockSubmission() {
    content.querySelectorAll('fieldset, #survey-contact').forEach(node => { node.disabled = !!submission; });
    const button = content.querySelector('button[type=submit]'); if (button) button.textContent = submission ? ui.retrySubmission : ui.submit;
  }
  const count = value => Array.from(new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(value)).length;
  const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
  function showError(message) { error.hidden = !message; error.textContent = message || ''; }
  function disableSubmit(value) { const submit = content.querySelector('button[type=submit]'); if (submit) submit.disabled = preview || value; }
  async function api(method, body) {
    if (preview) throw new Error('PREVIEW_READ_ONLY');
    const config = window.PIXKUY_BOOKING_API_CONFIG;
    if (!config || !config.apiBaseUrl || !config.publicSiteKey) throw new Error('CONFIG_UNAVAILABLE');
    if (body && !commandKey) commandKey = newCommandKey();
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
    const response = await fetch(config.apiBaseUrl.replace(/\/$/, '') + '/v1/public/feedback/' + (method === 'GET' ? 'context' : 'responses'), {
      method, signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json', 'X-Pixkuy-Site-Key': config.publicSiteKey, 'X-Pixkuy-Survey-Token': token, ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': commandKey } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (!response.ok) { const failure = new Error(data.code || 'REQUEST_FAILED'); failure.status = response.status; throw failure; }
    return data;
    } finally { clearTimeout(timer); }
  }
  function radio(q, value, label, cannot, container) {
    const wrapper = element('label', undefined, container.className === 'survey-rating' ? '' : 'survey-choice');
    const input = document.createElement('input'); input.type = q.type === 'multiple_choice' && !cannot ? 'checkbox' : 'radio';
    input.name = q.questionId; input.value = cannot ? 'cannot_rate' : String(value); input.id = q.questionId + '-' + input.value;
    input.dataset.question = q.questionId;
    const saved = answers.get(q.questionId);
    input.checked = cannot ? saved?.state === 'cannot_rate' : saved?.state === 'answered' && (Array.isArray(saved.value) ? saved.value.includes(value) : saved.value === value);
    if (q.required && q.type !== 'multiple_choice') input.required = true;
    input.addEventListener('change', () => {
      if (q.type === 'multiple_choice') { const values = new Set(answers.get(q.questionId)?.value || []); if (input.checked) values.add(value); else values.delete(value); if (values.size) answers.set(q.questionId, { state: 'answered', value: Array.from(values) }); else answers.delete(q.questionId); }
      else answers.set(q.questionId, cannot ? { state: 'cannot_rate' } : { state: 'answered', value });
      showError('');
    });
    wrapper.append(input, element('span', label)); container.append(wrapper); return {wrapper, input};
  }
  // Presentation only: identities, numeric values and published meanings stay intact.
  function starScale(q, field) {
    const row = element('div', undefined, 'survey-rating survey-stars');
    const status = element('p', undefined, 'survey-rating-status'); status.id = q.questionId + '-rating-status'; status.setAttribute('aria-live', 'polite');
    let hovering = null;
    const values = [...q.scaleContract].sort((a, b) => a.value - b.value);
    const controls = values.map(scale => {
      const control = radio(q, scale.value, scale.value + ' · ' + scale.labelsByLocale[locale], false, row);
      control.wrapper.className = 'survey-star'; control.input.setAttribute('aria-describedby', status.id);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
      const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', mobileForm.matches ? 'M12 2 14.5 8.9 22 9.2 16.1 13.8 18 21 12 16.7 6 21 7.9 13.8 2 9.2 9.5 8.9Z' : 'M12 2.8 14.8 8.5 21 9.4 16.5 13.8 17.6 20 12 17.1 6.4 20 7.5 13.8 3 9.4 9.2 8.5Z'); svg.append(path); control.wrapper.append(svg);
      control.wrapper.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse' && matchMedia('(hover: hover)').matches) { hovering = scale.value; update(); } });
      control.wrapper.addEventListener('pointerleave', () => { hovering = null; update(); });
      return control;
    });
    const clear = ratingClear(q, () => { answers.delete(q.questionId); hovering = null; field.querySelectorAll('input').forEach(input => { input.checked = false; }); showError(''); controls[0].input.focus({preventScroll:true}); update(); });
    function update() {
      const saved = answers.get(q.questionId), selected = saved?.state === 'answered' ? saved.value : null;
      row.dataset.preview = String(hovering !== null && hovering !== selected);
      controls.forEach(({wrapper}, index) => { wrapper.dataset.filled = String(values[index].value <= (hovering ?? selected ?? 0)); });
      const value = hovering ?? selected, scale = values.find(s => s.value === value);
      status.classList.toggle('survey-sr-only', !scale);
      status.textContent = scale ? (hovering !== null && hovering !== selected ? ui.ratingPreview + ': ' : '') + value + ' · ' + scale.labelsByLocale[locale] : saved?.state === 'cannot_rate' ? ui.cannotRate : ui.noAnswer;
      if (clear) clear.hidden = !saved;
    }
    field.addEventListener('change', () => { hovering = null; update(); });
    const actions = element('div', undefined, 'survey-rating-actions');
    if (q.validation.allowCannotRate) { const alternative = radio(q, null, ui.cannotRate, true, actions); alternative.wrapper.classList.add('survey-cannot'); }
    if (clear) actions.append(clear);
    field.append(row, status, actions); update();
  }
  function ratingClear(q, onClear, mobileOnly = false) {
    if (q.required) return null;
    const clear = element('button', undefined, 'survey-clear' + (mobileOnly ? ' survey-mobile-only' : ''));
    clear.type = 'button'; clear.hidden = !answers.has(q.questionId);
    clear.append(element('span', ui.clearAnswer, 'survey-desktop-only'), element('span', ui.clearRating, 'survey-mobile-only'));
    clear.addEventListener('click', onClear); return clear;
  }
  function renderQuestion(q) {
    const group = element('fieldset', undefined, 'survey-question'); group.dataset.type = q.type; group.id = q.questionId + '-group';
    group.dataset.required = String(q.required);
    const legend = element('legend', q.labelByLocale[locale]);
    if (q.required) legend.append(element('span', ' · ' + ui.required, 'survey-optional'));
    group.append(legend);
    const field = element('div', undefined, 'survey-controls'); group.append(field);
    if (q.helpByLocale[locale]) field.append(element('p', q.helpByLocale[locale], 'survey-help'));
    if (q.type === 'short_text') {
      const input = document.createElement('textarea'); input.id = q.questionId; input.dataset.question = q.questionId; input.required = q.required; input.value = answers.get(q.questionId)?.value || ''; input.setAttribute('aria-label', q.labelByLocale[locale]);
      const counter = element('p', undefined, 'survey-counter'); counter.id = q.questionId + '-count'; input.setAttribute('aria-describedby', counter.id);
      const update = () => { const remaining = q.validation.maxLength - count(input.value); counter.textContent = remaining + ' ' + ui.remaining; input.setCustomValidity(remaining < 0 ? ui.validation : ''); if (input.value.trim()) answers.set(q.questionId, { state: 'answered', value: input.value }); else answers.delete(q.questionId); };
      input.addEventListener('input', update); update(); field.append(input, counter);
    } else if (q.type === 'rating' && q.scaleContract.length === 5 && [1, 2, 3, 4, 5].every(value => q.scaleContract.some(scale => scale.value === value))) {
      starScale(q, field);
    } else {
      const choices = element('div', undefined, q.type === 'rating' ? 'survey-rating' : 'survey-choices');
      if (q.type === 'rating') [...q.scaleContract].sort((a, b) => a.value - b.value).forEach(s => radio(q, s.value, s.value + ' · ' + s.labelsByLocale[locale], false, choices));
      else [...q.options].sort((a, b) => a.order - b.order).forEach(o => radio(q, o.optionId, o.labelByLocale[locale], false, choices));
      field.append(choices);
      if (q.validation.allowCannotRate) { const cannot = element('div', undefined, 'survey-choices'); const alternative = radio(q, null, ui.cannotRate, true, cannot); if (q.type === 'rating') alternative.wrapper.classList.add('survey-cannot'); field.append(cannot); }
      if (q.type === 'rating' && !q.required) {
        const clear = ratingClear(q, () => { answers.delete(q.questionId); field.querySelectorAll('input').forEach(input => { input.checked = false; }); clear.hidden = true; showError(''); choices.querySelector('input')?.focus({preventScroll:true}); }, true);
        field.addEventListener('change', () => { clear.hidden = !answers.has(q.questionId); }); field.append(clear);
      }
    }
    if (q.displayMode === 'collapsed_optional' && !q.required && !(mobileForm.matches && q.type === 'short_text')) { const details = element('details', undefined, 'survey-optional-block'); details.open = expanded.has(q.questionId); legend.classList.add('survey-sr-only'); const summary = element('summary', q.labelByLocale[locale]); summary.setAttribute('aria-controls', group.id); details.append(summary, group); details.addEventListener('toggle', () => { if (details.open) expanded.add(q.questionId); else expanded.delete(q.questionId); }); return details; }
    return group;
  }
  function render() {
    const focus = document.activeElement?.id, scroll = window.scrollY;
    content.replaceChildren(); document.documentElement.lang = locale;
    if (['unavailable', 'retry', 'received', 'already'].includes(context.responseState)) {
      notice.textContent = '';
      const state = context.responseState;
      const title = element('h1', ui[state + 'Title']); title.tabIndex = -1; title.id = 'survey-state-title';
      const section = element('section', undefined, 'survey-state'); section.setAttribute('aria-labelledby', title.id);
      section.append(title, element('p', state === 'retry' ? ui.loadError : ui[state]));
      if (state === 'received' && contactRecorded) section.append(element('p', ui.contactRecorded));
      if (state === 'retry') { const retry = element('button', ui.retry); retry.type = 'button'; retry.addEventListener('click', () => { retry.disabled = true; notice.textContent = ui.loading; void start(); }); section.append(retry); }
      content.append(section); document.title = ui[state + 'Title'] + ' · Pixkuy'; return;
    }
    const doc = context.publication.questionnaire;
    content.append(element('h1', doc.titleByLocale[locale]));
    if (doc.introByLocale[locale]) content.append(element('p', doc.introByLocale[locale], 'survey-intro'));
    if (context.serviceSummary) content.append(element('p', context.serviceSummary, 'survey-service-summary'));
    if (context.serviceTimeByLocale?.[locale]) content.append(element('p', context.serviceTimeByLocale[locale], 'survey-service-time'));
    document.title = doc.titleByLocale[locale] + ' · Pixkuy';
    const form = document.createElement('form'); form.noValidate = false;
    let ratingHintShown = false;
    [...doc.sections].sort((a, b) => a.order - b.order).forEach((section, index) => {
      const questions = [...doc.questions].filter(q => q.sectionId === section.sectionId).sort((a, b) => a.order - b.order);
      const block = element('section', undefined, 'survey-section'); block.dataset.section = section.sectionId;
      block.dataset.leadRating = String(index === 0 && questions.length === 1 && questions[0].type === 'rating' && questions[0].required);
      const heading = element('h2', section.titleByLocale[locale]); heading.id = section.sectionId + '-heading'; block.setAttribute('aria-labelledby', heading.id); block.append(heading);
      if (!ratingHintShown && questions.some(q => q.type === 'rating' && !q.required)) { block.append(element('p', ui.optionalRatingHint, 'survey-mobile-only survey-help survey-rating-hint')); ratingHintShown = true; }
      questions.forEach(q => block.append(renderQuestion(q)));
      form.append(block);
    });
    const label = element('label', undefined, 'survey-contact'); const contact = document.createElement('input'); contact.type = 'checkbox'; contact.id = 'survey-contact'; contact.checked = requestedContact; contact.addEventListener('change', () => { requestedContact = contact.checked; }); label.append(contact, element('span', ui.requestContact)); form.append(label);
    const submit = element('button', ui.submit); submit.type = 'submit'; submit.disabled = preview || pending; form.append(submit);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (preview || pending || !ui) return;
      for (const q of doc.questions) {
        const a = answers.get(q.questionId);
        if ((q.required && !a) || (q.type === 'multiple_choice' && a && (a.value.length < Math.max(q.required ? 1 : 0, q.validation.minSelections) || a.value.length > q.validation.maxSelections))) { showError(ui.validation); const input = content.querySelector('[data-question="' + q.questionId + '"]'); input?.focus(); return; }
      }
      pending = true; disableSubmit(true); showError('');
      try {
        // A retry after an uncertain result sends exactly the original payload and key.
        submission ||= { versionId: context.publication.versionId, locale, answers: Array.from(answers, ([questionId, answer]) => ({ questionId, ...answer })), requestContact: requestedContact };
        lockSubmission();
        const receipt = await api('POST', submission);
        if (receipt.responseState !== 'received' || typeof receipt.responseId !== 'string' || !receipt.receivedAt || typeof receipt.contactRequested !== 'boolean') throw new Error('RECEIPT_INVALID');
        contactRecorded = receipt.contactRequested === true; context.responseState = 'received'; submission = null; answers.clear(); render(); document.getElementById('survey-state-title')?.focus();
      } catch (failure) {
        if ([404, 410, 409].includes(failure.status)) { context.responseState = failure.status === 409 ? 'already' : 'unavailable'; contactRecorded = false; submission = null; render(); document.getElementById('survey-state-title')?.focus(); }
        else if ([400, 422].includes(failure.status) || failure.message === 'SECURE_RANDOM_UNAVAILABLE') { submission = null; commandKey = null; showError(failure.status === 422 ? ui.validation : ui.error); }
        else showError(ui.uncertainSubmission);
      } finally { pending = false; lockSubmission(); disableSubmit(false); }
    });
    content.append(form); lockSubmission(); if (focus) document.getElementById(focus)?.focus({ preventScroll: true }); window.scrollTo(0, scroll);
  }
  async function choose(value) {
    const current = ++sequence; disableSubmit(true); showError('');
    try {
      const [loaded, shell] = await bounded(Promise.all([modules.loadRequiredFragment(value, 'service-feedback'), modules.loadTranslationsForLang(value, ['chauffeurs-mobile-screen'])]));
      if (!shell?.mobileMenu?.items?.chauffeurs?.trim()) throw new Error('I18N_INCOMPLETE');
      const required = ['cannotRate', 'requestContact', 'submit', 'received', 'unavailable', 'error', 'languageUnavailable', 'required', 'optional', 'remaining', 'loading', 'language', 'validation', 'textHelp', 'clearAnswer', 'clearRating', 'optionalRatingHint', 'ratingPreview', 'noAnswer', 'retry', 'loadError', 'receivedTitle', 'alreadyTitle', 'already', 'unavailableTitle', 'retryTitle', 'contactRecorded', 'retrySubmission', 'uncertainSubmission'];
      if ((preview && !loaded.feedback.preview?.trim()) || required.some(k => !loaded.feedback[k]?.trim())) throw new Error('I18N_INCOMPLETE');
      if (current !== sequence) return;
      locale = value; ui = loaded.feedback; window.__pixkuyI18nLang = value; modules.applyI18nToDom(shell, value); modules.updateLangUI(value); document.querySelectorAll('[data-i18n-aria-label]').forEach(node => { const label = modules.getValue(shell, node.dataset.i18nAriaLabel); if (typeof label === 'string') node.setAttribute('aria-label', label); }); window.dispatchEvent(new CustomEvent('pixkuy:i18n-applied', {detail:{lang:value,dict:shell}})); notice.textContent = preview ? ui.preview : ''; render(); if (preview) { tellPreview('pixkuy-feedback-preview-rendered'); requestAnimationFrame(() => tellPreview('pixkuy-feedback-preview-height')); }
    } catch {
      if (current !== sequence) return;
      if (ui) { showError(ui.languageUnavailable + ' · ' + value); disableSubmit(pending); }
      else {
        notice.textContent = ''; content.replaceChildren();
        const section = element('section', undefined, 'survey-state');
        section.append(element('h1', 'No se pudo cargar / Unable to load'), element('p', 'Seleccione otro idioma o vuelva a intentarlo. / Choose another language or try again.'));
        const retry = element('button', 'Volver a intentar / Try again'); retry.type = 'button'; retry.addEventListener('click', () => { retry.disabled = true; void choose(value); }); section.append(retry); content.append(section);
      }
    }
  }
  async function start() {
    try {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw Object.assign(new Error('LINK_UNAVAILABLE'), {status:404});
      const config = window.PixkuyBookingPublicConfig;
      if (!config) throw new Error('CONFIG_UNAVAILABLE');
      await bounded(context?.responseState === 'retry' ? config.load() : config.ready);
      context = await api('GET');
      if (context.responseState === 'received') context.responseState = 'already';
      else if (context.responseState !== 'pending' || !context.publication?.questionnaire) throw new Error('CONTEXT_INVALID');
      const locales = context.publication?.locales || context.locales;
      setAvailableLocales(locales);
      const explicit = new URLSearchParams(location.search).get('lang');
      const wanted = modules.normalizeLangCode(explicit || context.preferredLocale || navigator.language);
      const selected = locales.some(l => l.code === wanted) ? wanted : locales[0].code;
      await choose(selected);
      if (explicit && !locales.some(l => l.code === modules.normalizeLangCode(explicit))) notice.textContent = ui?.languageUnavailable || 'Choose an available language';
    } catch (failure) {
      const available = modules.SUPPORTED_LANGS.map(item => ({ code: item.code, nativeName: modules.LANGUAGE_CATALOG[item.code].label }));
      context = { responseState: [404, 410].includes(failure.status) ? 'unavailable' : 'retry', locales: available };
      setAvailableLocales(available);
      const wanted = modules.normalizeLangCode(new URLSearchParams(location.search).get('lang') || navigator.language);
      await choose(available.some(item => item.code === wanted) ? wanted : 'es');
    }
  }
  if (preview) {
    // A preview never requests invitation context or submits answers. Accept only
    // the embedding window, exact origin and nonce, and render with the same code.
    window.addEventListener('message', async event => {
      if (!previewOrigin || event.source !== window.parent || event.origin !== previewOrigin || event.data?.type !== 'pixkuy-feedback-preview' || event.data.nonce !== previewNonce) return;
      try {
        const { document: doc, locales, locale: selected } = event.data;
        if (!doc || doc.schemaVersion !== 1 || !Array.isArray(doc.sections) || doc.sections.length > 30 || !Array.isArray(doc.questions) || doc.questions.length > 100 || !Array.isArray(locales) || !locales.length || locales.length > 9 || !locales.every(l => modules.SUPPORTED_LANGS.some(v => v.code === l.code)) || !locales.some(l => l.code === selected)) throw new Error('PREVIEW_INVALID');
        const fingerprint = JSON.stringify(doc); if (fingerprint.length > 400000) throw new Error('PREVIEW_TOO_LARGE');
        if (fingerprint !== previewFingerprint) { answers.clear(); expanded.clear(); requestedContact = false; previewFingerprint = fingerprint; }
        context = { responseState: 'pending', publication: { questionnaire: doc, locales }, serviceSummary: '' };
        setAvailableLocales(locales);
        await choose(selected);
      } catch { tellPreview('pixkuy-feedback-preview-error'); }
    });
    if (previewOrigin && window.parent !== window) {
      document.body.classList.add('survey-preview');
      if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (context && ui) tellPreview('pixkuy-feedback-preview-height'); }).observe(content);
      tellPreview('pixkuy-feedback-preview-ready');
    } else { notice.textContent = 'Abre la vista previa desde Admin / Open preview from Admin'; }
  } else void start();
})();
