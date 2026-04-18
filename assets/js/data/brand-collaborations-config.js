(function () {
  const config = {
    enabled: false,
    items: {
      casaDelAgua: {
        enabled: false,
        order: 10,
        brandName: 'Casa del Agua',
        logoSrc: 'assets/img/brand-collaborations/casa-del-agua-logo.png',
logoAlt: 'Casa del Agua',
        imageSrc: 'assets/img/brand-collaborations/casa-del-agua-hero.png',
        imageAlt: 'Casa del Agua',
        href: 'https://casadelagua.com.mx/?utm_source=pixkuy.com&utm_medium=referral&utm_campaign=brand-collaborations',
        copyKey: 'brandCollaborations.items.casaDelAgua.copy'
      }
    }
  };

  window.PixkuyBrandCollaborations = Object.freeze({
    enabled: !!config.enabled,
    items: Object.freeze(
      Object.keys(config.items).reduce((acc, key) => {
        const item = config.items[key] || {};

        acc[key] = Object.freeze({
          enabled: !!item.enabled,
          order: Number.isFinite(item.order) ? item.order : 9999,
          brandName: typeof item.brandName === 'string' ? item.brandName.trim() : '',
          logoSrc: typeof item.logoSrc === 'string' ? item.logoSrc.trim() : '',
          logoAlt: typeof item.logoAlt === 'string' ? item.logoAlt.trim() : '',
          imageSrc: typeof item.imageSrc === 'string' ? item.imageSrc.trim() : '',
          imageAlt: typeof item.imageAlt === 'string' ? item.imageAlt.trim() : '',
          href: typeof item.href === 'string' ? item.href.trim() : '',
          copyKey: typeof item.copyKey === 'string' ? item.copyKey.trim() : ''
        });

        return acc;
      }, {})
    )
  });
})();