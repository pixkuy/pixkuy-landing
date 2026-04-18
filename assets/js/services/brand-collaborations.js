(function () {
  const config = window.PixkuyBrandCollaborations;
  const section = document.getElementById('brand-collaborations');
  const root = document.querySelector('[data-brand-collaborations-root]');

  if (!config || !config.enabled || !config.items || typeof config.items !== 'object') {
    return;
  }

  if (!section || !root) {
    return;
  }

  function getI18nValue(path) {
    const dict = window.__pixkuyI18nDict || null;

    if (!dict || !path) return '';

    return path.split('.').reduce((acc, key) => {
      if (!acc || typeof acc !== 'object') return '';
      return acc[key];
    }, dict) || '';
  }

  function appendInlineCopyNodes(target, value) {
    if (!target) return;

    const raw = typeof value === 'string' ? value : '';

    if (!raw || raw.indexOf('<em>') === -1) {
      target.textContent = raw;
      return;
    }

    const template = document.createElement('template');
    template.innerHTML = raw;

    Array.from(template.content.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        target.appendChild(document.createTextNode(child.textContent || ''));
        return;
      }

      if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'EM') {
        const em = document.createElement('em');
        em.textContent = child.textContent || '';
        target.appendChild(em);
        return;
      }

      target.appendChild(document.createTextNode(child.textContent || ''));
    });
  }

  function setCopyParagraphs(node, value) {
    if (!node) return;

    const raw = typeof value === 'string' ? value : '';
    const parts = raw
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (!parts.length) {
      node.textContent = '';
      return;
    }

    const fragment = document.createDocumentFragment();

    parts.forEach((part) => {
      const paragraph = document.createElement('p');
      paragraph.className = 'brand-collaborations__copy-paragraph';
      appendInlineCopyNodes(paragraph, part);
      fragment.appendChild(paragraph);
    });

    node.replaceChildren(fragment);
  }

  const activeItems = Object.entries(config.items)
    .filter(([, item]) => !!(item && item.enabled))
    .sort(([, a], [, b]) => {
      const orderA = Number.isFinite(a.order) ? a.order : 9999;
      const orderB = Number.isFinite(b.order) ? b.order : 9999;
      return orderA - orderB;
    });

  if (!activeItems.length) {
    return;
  }

  const runtimeItems = activeItems.map(([key, item]) => ({
    key,
    order: Number.isFinite(item.order) ? item.order : 9999,
    brandName: typeof item.brandName === 'string' ? item.brandName.trim() : '',
    logoSrc: typeof item.logoSrc === 'string' ? item.logoSrc.trim() : '',
    logoAlt: typeof item.logoAlt === 'string' ? item.logoAlt.trim() : '',
    imageSrc: typeof item.imageSrc === 'string' ? item.imageSrc.trim() : '',
    imageAlt: typeof item.imageAlt === 'string' ? item.imageAlt.trim() : '',
    href: typeof item.href === 'string' ? item.href.trim() : '',
    copyKey: typeof item.copyKey === 'string' ? item.copyKey.trim() : ''
  }));

  window.PixkuyBrandCollaborationsRuntime = Object.freeze({
    activeItems: Object.freeze(
      runtimeItems.map((item) => Object.freeze({ ...item }))
    )
  });

  function renderBrandCollaborations() {
    root.innerHTML = '';

    const title = document.createElement('h2');
    title.className = 'brand-collaborations__title';
    title.textContent = getI18nValue('brandCollaborations.title');

    root.appendChild(title);

    const list = document.createElement('div');
    list.className = 'brand-collaborations__list';

    if (runtimeItems.length === 1) {
      list.classList.add('brand-collaborations__list--single');
    }

    runtimeItems.forEach((item) => {
      const article = document.createElement('article');
      article.className = 'brand-collaborations__item';
      article.setAttribute('data-brand-collaboration-item', item.key);

      if (item.href) {
        article.setAttribute('role', 'link');
        article.setAttribute('tabindex', '0');

        article.addEventListener('click', () => {
          window.open(item.href, '_blank', 'noopener,noreferrer');
        });

        article.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            window.open(item.href, '_blank', 'noopener,noreferrer');
          }
        });
      }

      const content = document.createElement('div');
      content.className = 'brand-collaborations__item-content';

      const media = document.createElement('div');
      media.className = 'brand-collaborations__item-media';
      media.setAttribute('data-brand-collaboration-media', item.key);

      if (item.imageSrc) {
        const image = document.createElement('img');
        image.className = 'brand-collaborations__image';
        image.src = item.imageSrc;
        image.alt = item.imageAlt || item.brandName || '';
        image.loading = 'lazy';
        image.decoding = 'async';
        media.appendChild(image);
      }

      const body = document.createElement('div');
      body.className = 'brand-collaborations__item-body';

      const brand = document.createElement('h3');
      brand.className = 'brand-collaborations__brand';
      brand.textContent = item.brandName || '';

      const copy = document.createElement('div');
      copy.className = 'brand-collaborations__copy';
      setCopyParagraphs(copy, getI18nValue(item.copyKey));

      const footer = document.createElement('div');
      footer.className = 'brand-collaborations__footer';

      const line = document.createElement('span');
      line.className = 'brand-collaborations__footer-line';
      line.setAttribute('aria-hidden', 'true');
      footer.appendChild(line);

      if (item.logoSrc) {
        const logo = document.createElement('img');
        logo.className = 'brand-collaborations__logo';
        logo.src = item.logoSrc;
        logo.alt = item.logoAlt || item.brandName || '';
        logo.loading = 'lazy';
        logo.decoding = 'async';
        footer.appendChild(logo);
      }

      body.appendChild(brand);
      body.appendChild(copy);
      body.appendChild(footer);

      content.appendChild(media);
      content.appendChild(body);
      article.appendChild(content);
      list.appendChild(article);
    });

    root.appendChild(list);
    section.hidden = false;
  }

  renderBrandCollaborations();

  window.addEventListener('pixkuy:i18n-applied', renderBrandCollaborations);
})();