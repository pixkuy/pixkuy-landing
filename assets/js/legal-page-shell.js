/* Standalone legal pages — shared Pixkuy public shell. */

(function initLegalPageShell(window, document) {
  "use strict";

  if (!window || !document || !document.body) {
    return;
  }

  const PUBLIC_ORIGIN = "https://www.pixkuy.com";
  const DEFAULT_LANG = "es";
  const SUPPORTED_LANGS = ["es", "en", "ru", "fr", "pt", "it", "de", "ko", "zh-hans"];
  const RESERVATION_LINKS = [
    { action: "hourly", service: "hourly_daily", key: "mobileMenu.items.hourly", icon: "hourly", featured: true, primary: true },
    { action: "airport", service: "airport_hotel", key: "mobileMenu.items.airport", icon: "airport", featured: true },
    { action: "tours", service: "tour_private", key: "mobileMenu.items.tours", icon: "tours", featured: true },
    { action: "direct", service: "direct_transfer", key: "mobileMenu.items.direct", icon: "direct" },
    { action: "events", service: "event_special", key: "mobileMenu.items.events", icon: "events" }
  ];
  const PIXKUY_LINKS = [
    { action: "chauffeurs", hash: "chauffeurs", key: "mobileMenu.items.chauffeurs", icon: "chauffeurs" },
    { action: "inMotion", hash: "pixkuy-in-motion", key: "mobileMenu.items.inMotion", icon: "in-motion" },
    { action: "brands", hash: "brand-collaborations", key: "mobileMenu.items.brands", icon: "brands" },
    { action: "fleet", hash: "fleet", key: "mobileMenu.items.fleet", icon: "fleet" }
  ];

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function normalizeLang(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/_/g, "-");
    return SUPPORTED_LANGS.indexOf(normalized) !== -1 ? normalized : DEFAULT_LANG;
  }

  function getCurrentLang() {
    const params = new URLSearchParams(window.location.search);
    return normalizeLang(window.__pixkuyI18nLang || params.get("lang") || document.documentElement.lang);
  }

  function buildPublicUrl(lang, options) {
    const safeOptions = options || {};
    const url = new URL(safeOptions.path || "/", PUBLIC_ORIGIN);

    url.searchParams.set("lang", normalizeLang(lang));
    if (safeOptions.service) {
      url.searchParams.set("service", safeOptions.service);
    }
    if (safeOptions.hash) {
      url.hash = safeOptions.hash;
    }

    return url.href;
  }

  function renderNavigationItem(item) {
    const classNames = ["mobile-topbar-menu__item"];
    if (item.featured) classNames.push("mobile-topbar-menu__item--featured");
    if (item.primary) classNames.push("mobile-topbar-menu__item--primary");

    return [
      '<a class="' + classNames.join(" ") + '"',
      ' href="' + escapeAttribute(buildPublicUrl(getCurrentLang(), item)) + '"',
      ' data-legal-shell-link',
      ' data-service="' + escapeAttribute(item.service || "") + '"',
      ' data-hash="' + escapeAttribute(item.hash || "") + '"',
      ' data-mobile-topbar-menu-native="true"',
      ' data-mobile-topbar-menu-action="' + escapeAttribute(item.action) + '">',
      '  <span class="mobile-topbar-menu__media mobile-topbar-menu__media--' + escapeAttribute(item.icon) + '" aria-hidden="true"></span>',
      '  <span class="mobile-topbar-menu__copy">',
      '    <span class="mobile-topbar-menu__item-title" data-i18n="' + escapeAttribute(item.key) + '"></span>',
      "  </span>",
      "</a>"
    ].join("");
  }

  function renderDesktopNavigation() {
    return RESERVATION_LINKS.map(function renderItem(item) {
      return [
        '<a href="' + escapeAttribute(buildPublicUrl(getCurrentLang(), item)) + '"',
        ' data-legal-shell-link data-service="' + escapeAttribute(item.service) + '"',
        ' data-i18n="' + escapeAttribute(item.key) + '"></a>'
      ].join("");
    }).join("");
  }

  function createShell() {
    const shell = document.createElement("div");
    shell.className = "legal-page-shell";
    shell.setAttribute("data-legal-page-shell", "");
    shell.innerHTML = [
      '<header class="legal-page-header">',
      '  <a class="legal-page-header__brand" href="' + escapeAttribute(buildPublicUrl(getCurrentLang())) + '" data-legal-shell-link aria-label="Pixkuy Mobility">',
      '    <img src="../assets/img/pixkuy-logo-white.webp" alt="PIXKUY MOBILITY" width="220" height="64">',
      "  </a>",
      '  <nav class="legal-page-header__nav" data-i18n-aria-label="mobileMenu.ariaLabel">',
      renderDesktopNavigation(),
      "  </nav>",
      "</header>",
      '<div class="mobile-topbar" data-mobile-topbar>',
      '  <button type="button" class="mobile-topbar__menu-trigger" data-mobile-topbar-menu-trigger aria-controls="mobile-topbar-menu" aria-expanded="false">',
      '    <span class="mobile-topbar__menu-icon" aria-hidden="true"><span></span><span></span><span></span></span>',
      '    <span class="visually-hidden" data-i18n="mobileMenu.open"></span>',
      "  </button>",
      '  <a class="mobile-topbar__brand" href="' + escapeAttribute(buildPublicUrl(getCurrentLang())) + '" data-legal-shell-link aria-label="Pixkuy Mobility">',
      '    <img src="../assets/img/pixkuy-logo_only words-white.webp" alt="Pixkuy Mobility" width="224" height="64" loading="eager" decoding="async">',
      "  </a>",
      "</div>",
      '<div id="mobile-topbar-menu" class="mobile-topbar-menu" data-mobile-topbar-menu aria-hidden="true" hidden>',
      '  <button type="button" class="mobile-topbar-menu__backdrop" data-mobile-topbar-menu-dismiss>',
      '    <span class="visually-hidden" data-i18n="mobileMenu.close"></span>',
      "  </button>",
      '  <div class="mobile-topbar-menu__panel" data-mobile-topbar-menu-panel role="dialog" aria-modal="true" aria-labelledby="mobile-topbar-menu-title" tabindex="-1">',
      '    <div class="mobile-topbar-menu__handle" aria-hidden="true"></div>',
      '    <h2 id="mobile-topbar-menu-title" class="visually-hidden" data-i18n="mobileMenu.ariaLabel"></h2>',
      '    <nav class="mobile-topbar-menu__nav" aria-labelledby="mobile-topbar-menu-title">',
      '      <div class="mobile-topbar-menu__group">',
      '        <p class="mobile-topbar-menu__group-title" data-i18n="mobileMenu.reservations"></p>',
      RESERVATION_LINKS.map(renderNavigationItem).join(""),
      "      </div>",
      '      <div class="mobile-topbar-menu__group">',
      '        <p class="mobile-topbar-menu__group-title" data-i18n="mobileMenu.pixkuy"></p>',
      PIXKUY_LINKS.map(renderNavigationItem).join(""),
      "      </div>",
      "    </nav>",
      "  </div>",
      "</div>",
      '<nav class="lang" aria-label="Language selector">',
      '  <button class="lang-trigger" id="lang-trigger" type="button" aria-haspopup="menu" aria-expanded="false">',
      '    <span class="lang-current" aria-hidden="true"></span>',
      '    <span class="visually-hidden" data-i18n="ui.language"></span>',
      "  </button>",
      '  <ul class="lang-menu" role="menu" aria-labelledby="lang-trigger" hidden></ul>',
      "</nav>"
    ].join("");

    return shell;
  }

  function createFooter() {
    const footer = document.createElement("footer");
    footer.className = "screen legal legal-page-footer";
    footer.setAttribute("role", "contentinfo");
    footer.setAttribute("data-legal-page-footer", "");
    footer.innerHTML = [
      '<div class="content">',
      '  <img class="legal-logo" src="../assets/img/pixkuy-logo-white.webp" alt="PIXKUY MOBILITY" loading="lazy" decoding="async">',
      '  <p class="muted" data-i18n="legal.tagline"></p>',
      '  <address class="muted">',
      '    <div>Pixkuy Mobility S.A. de C.V.</div>',
      '    <div data-i18n="legal.location"></div>',
      '    <div data-i18n="legal.contact"></div>',
      "  </address>",
      '  <div class="legal-social">',
      '    <a href="https://www.linkedin.com/company/pixkuy-mobility/" target="_blank" rel="noopener noreferrer" aria-label="Pixkuy Mobility — LinkedIn">',
      '      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">',
      '        <path d="M4.98 3.5C4.98 4.6 4.08 5.5 2.98 5.5C1.88 5.5 1 4.6 1 3.5C1 2.4 1.88 1.5 2.98 1.5C4.08 1.5 4.98 2.4 4.98 3.5Z" fill="currentColor"></path>',
      '        <path d="M1.5 8.5H4.5V23H1.5V8.5Z" fill="currentColor"></path>',
      '        <path d="M8.5 8.5H11.3V10.48H11.34C11.73 9.74 12.68 8.96 14.09 8.96C17.18 8.96 17.75 11 17.75 14.15V23H14.75V14.97C14.75 13.06 14.71 10.6 12.46 10.6C10.17 10.6 9.82 12.43 9.82 14.84V23H6.82V8.5H8.5Z" fill="currentColor"></path>',
      "      </svg>",
      "    </a>",
      '    <a href="https://www.instagram.com/pixkuymobility/" target="_blank" rel="noopener noreferrer" aria-label="Pixkuy Mobility — Instagram">',
      '      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">',
      '        <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5" stroke="currentColor" stroke-width="1.8"></rect>',
      '        <circle cx="12" cy="12" r="4.1" stroke="currentColor" stroke-width="1.8"></circle>',
      '        <circle cx="17.35" cy="6.65" r="1.15" fill="currentColor"></circle>',
      "      </svg>",
      "    </a>",
      "  </div>",
      '  <nav class="legal-links" aria-label="Legal">',
      '    <a href="' + escapeAttribute(buildPublicUrl(getCurrentLang(), { path: "/legal/aviso-legal.html" })) + '" data-legal-shell-link data-path="/legal/aviso-legal.html" data-i18n="legal.links.notice"></a>',
      '    <span aria-hidden="true">·</span>',
      '    <a href="' + escapeAttribute(buildPublicUrl(getCurrentLang(), { path: "/legal/privacy.html" })) + '" data-legal-shell-link data-path="/legal/privacy.html" data-i18n="legal.links.privacy"></a>',
      '    <span aria-hidden="true">·</span>',
      '    <a href="' + escapeAttribute(buildPublicUrl(getCurrentLang(), { path: "/legal/cookies.html" })) + '" data-legal-shell-link data-path="/legal/cookies.html" data-i18n="legal.links.cookies"></a>',
      '    <span aria-hidden="true">·</span>',
      '    <a href="' + escapeAttribute(buildPublicUrl(getCurrentLang(), { path: "/legal/terms.html" })) + '" data-legal-shell-link data-path="/legal/terms.html" data-i18n="legal.links.terms"></a>',
      '    <span aria-hidden="true">·</span>',
      '    <a href="' + escapeAttribute(buildPublicUrl(getCurrentLang(), { path: "/legal/cancellations.html" })) + '" data-legal-shell-link data-path="/legal/cancellations.html" data-i18n="legal.links.cancellations"></a>',
      "  </nav>",
      "</div>"
    ].join("");
    return footer;
  }

  function syncLinks(lang) {
    document.querySelectorAll("[data-legal-shell-link]").forEach(function updateLink(link) {
      link.href = buildPublicUrl(lang, {
        path: link.getAttribute("data-path") || "/",
        service: link.getAttribute("data-service") || "",
        hash: link.getAttribute("data-hash") || ""
      });
    });
  }

  const main = document.querySelector("main.screen.legal");
  const shell = createShell();
  document.body.insertBefore(shell, main || document.body.firstChild);
  if (main) {
    main.insertAdjacentElement("afterend", createFooter());
  } else {
    document.body.appendChild(createFooter());
  }
  syncLinks(getCurrentLang());

  window.addEventListener("pixkuy:i18n-applied", function handleLanguage(event) {
    syncLinks(event && event.detail ? event.detail.lang : getCurrentLang());
  });
})(window, document);
