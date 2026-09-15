(function (window, document) {
  'use strict';
  const selector = '.services-events-panel__event-media img.services-events-panel__event-image, .events-mobile-stack-card__media img.events-mobile-stack-card__image';
  const prepared = new WeakSet();
  const text = (key, fallback) => {
    const panel = window.__pixkuyI18nDict?.services?.cards?.events?.panel;
    return typeof panel?.[key] === 'string' ? panel[key] : fallback;
  };
  let viewer = null;
  function openPoster(image, trigger) {
    if (!image.naturalWidth || viewer?.open) return;
    const scroll = { x: window.scrollX, y: window.scrollY };
    const dialog = document.createElement('dialog');
    dialog.className = 'events-catalog-poster-viewer';
    dialog.setAttribute('aria-label', image.alt);
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'events-catalog-poster-viewer__close';
    close.textContent = text('posterCloseLabel', 'Cerrar cartel del evento');
    const full = document.createElement('img');
    full.src = image.currentSrc || image.src;
    full.alt = image.alt;
    full.width = image.naturalWidth; full.height = image.naturalHeight;
    dialog.append(close, full); document.body.append(dialog); viewer = dialog;
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Tab') { event.preventDefault(); close.focus(); }
    });
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      dialog.remove(); viewer = null;
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
      window.scrollTo(scroll.x, scroll.y);
    }, { once: true });
    dialog.showModal(); close.focus({ preventScroll: true });
  }
  function enhance(image) {
    if (prepared.has(image)) return;
    prepared.add(image);
    const picture = image.closest('picture');
    const frame = document.createElement('span');
    frame.className = 'events-catalog-poster';
    const action = document.createElement('span');
    action.className = 'events-catalog-poster-action';
    const original = picture || image;
    original.before(action); action.append(frame); frame.append(original);
    const backdrop = document.createElement('span');
    backdrop.className = 'events-catalog-poster__backdrop'; backdrop.setAttribute('aria-hidden', 'true');
    const trigger = document.createElement('button');
    trigger.type = 'button'; trigger.className = 'events-catalog-poster__open';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-label', text('posterViewLabel', 'Ver cartel') + ': ' + image.alt);
    trigger.innerHTML = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></svg>';
    const label = document.createElement('span');
    label.className = 'events-catalog-poster__label';
    label.textContent = text('posterViewLabel', 'Ver cartel');
    label.setAttribute('aria-hidden', 'true');
    trigger.append(label);
    frame.prepend(backdrop); action.append(trigger);
    const update = () => {
      const available = image.complete && image.naturalWidth > 0;
      trigger.disabled = !available;
      // Reuses currentSrc, including the existing responsive source/fallback.
      backdrop.style.backgroundImage = available ? 'url(' + JSON.stringify(image.currentSrc || image.src) + ')' : '';
    };
    image.addEventListener('load', update); image.addEventListener('error', update); update();
    trigger.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openPoster(image, trigger); });
    // Ancestor cards also bind Enter/Space; the native button handles these.
    trigger.addEventListener('keydown', event => event.stopPropagation());
  }
  function scan(root) {
    if (root.matches?.(selector)) enhance(root);
    root.querySelectorAll?.(selector).forEach(enhance);
  }
  scan(document);
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) scan(node); }));
  }).observe(document.body, { childList: true, subtree: true });
})(window, document);
