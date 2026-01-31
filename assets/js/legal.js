/* assets/js/legal.js
 *
 * Legal Overlay / Drawer (responsive) — DOM version (no iframe)
 * - Mobile: full-screen sheet
 * - Desktop: right drawer
 * - No iframes (compatible with X-Frame-Options: DENY)
 * - No literals: all labels/aria from i18n keys (legalOverlay.*)
 * - One reusable overlay with modes: notice | privacy | cookies
 */

(function () {
  "use strict";

  var OVERLAY_ID = "pixkuy-legal-overlay";
  var BODY_LOCK_CLASS = "pixkuy-legal-lock";

  function getModeFromHref(href) {
    if (typeof href !== "string") return null;
    if (href.indexOf("legal/aviso-legal") !== -1) return "notice";
    if (href.indexOf("legal/privacy") !== -1) return "privacy";
    if (href.indexOf("legal/cookies") !== -1) return "cookies";
    return null;
  }

  function isLegalHref(href) {
  if (typeof href !== "string") return false;
  // Accept both "legal/*.html" and "/legal/*" (pretty URLs)
  return href.indexOf("legal/") !== -1;
}


  function ensureStyles() {
    if (document.getElementById("pixkuy-legal-overlay-styles")) return;

    var style = document.createElement("style");
    style.id = "pixkuy-legal-overlay-styles";
    style.textContent = [
      "body." + BODY_LOCK_CLASS + "{ overflow:hidden !important; }",
      "#" + OVERLAY_ID + "{ position:fixed; inset:0; z-index:9999; display:none; }",
      "#" + OVERLAY_ID + "[data-open='1']{ display:block; }",

      "#" + OVERLAY_ID + " .pxk-legal-backdrop{ position:absolute; inset:0; background:rgba(0,0,0,.62); backdrop-filter:blur(6px); }",

      "#" + OVERLAY_ID + " .pxk-legal-panel{ position:absolute; inset:0; background:rgba(15,17,19,.98); border-left:1px solid rgba(255,255,255,.10); box-shadow:0 20px 80px rgba(0,0,0,.55); transform:translateY(12px); opacity:0; transition:transform .22s ease, opacity .22s ease; display:flex; flex-direction:column; }",
      "#" + OVERLAY_ID + "[data-open='1'] .pxk-legal-panel{ transform:translateY(0); opacity:1; }",

      "#" + OVERLAY_ID + " .pxk-legal-bar{ position:sticky; top:0; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,.10); background:rgba(15,17,19,.92); backdrop-filter:blur(10px); }",

      "#" + OVERLAY_ID + " .pxk-legal-brand{ display:flex; align-items:center; gap:10px; min-width:0; }",
      "#" + OVERLAY_ID + " .pxk-legal-logo{ width:22px; height:22px; border-radius:99px; border:1px solid rgba(255,255,255,.16); display:inline-flex; align-items:center; justify-content:center; opacity:.9; }",
      "#" + OVERLAY_ID + " .pxk-legal-title{ font-size:13px; letter-spacing:.04em; text-transform:uppercase; opacity:.78; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",

      "#" + OVERLAY_ID + " .pxk-legal-close{ appearance:none; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:rgba(255,255,255,.92); border-radius:999px; padding:8px 12px; font-size:13px; cursor:pointer; }",
      "#" + OVERLAY_ID + " .pxk-legal-close:hover{ background:rgba(255,255,255,.10); }",

      "#" + OVERLAY_ID + " .pxk-legal-tabs{ display:flex; gap:10px; padding:12px 16px 0; }",
      "#" + OVERLAY_ID + " .pxk-legal-tab{ appearance:none; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); color:rgba(255,255,255,.90); border-radius:999px; padding:8px 12px; font-size:13px; cursor:pointer; opacity:.78; }",
      "#" + OVERLAY_ID + " .pxk-legal-tab[aria-selected='true']{ opacity:1; background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.18); }",

      "#" + OVERLAY_ID + " .pxk-legal-body{ padding:16px; overflow:auto; -webkit-overflow-scrolling:touch; }",
      "#" + OVERLAY_ID + " .pxk-legal-body h2{ margin:16px 0 8px; }",
      "#" + OVERLAY_ID + " .pxk-legal-body p{ margin:0 0 10px; }",

      /* Hide duplicated section titles (visual only, keep semantics) */
      "#" + OVERLAY_ID + " .pxk-legal-body h1{",
      "  position:absolute !important;",
      "  width:1px !important;",
      "  height:1px !important;",
      "  padding:0 !important;",
      "  margin:-1px !important;",
      "  overflow:hidden !important;",
      "  clip:rect(0,0,0,0) !important;",
      "  white-space:nowrap !important;",
      "  border:0 !important;",
      "}",

      "@media (min-width:860px){",
      "  #" + OVERLAY_ID + " .pxk-legal-panel{ inset:0 0 0 auto; width:min(760px,88vw); transform:translateX(18px); }",
      "  #" + OVERLAY_ID + "[data-open='1'] .pxk-legal-panel{ transform:translateX(0); }",
      "}"
    ].join("\n");

    document.head.appendChild(style);
  }

  function ensureOverlay() {
    var existing = document.getElementById(OVERLAY_ID);
    if (existing) return existing;

    ensureStyles();

    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("data-mode", "notice");
    overlay.setAttribute("data-i18n-aria", "legalOverlay.ariaLabel");

    overlay.innerHTML = [
      '<div class="pxk-legal-backdrop" data-legal-close="1" aria-hidden="true"></div>',
      '<div class="pxk-legal-panel" role="document">',
      '  <div class="pxk-legal-bar">',
      '    <div class="pxk-legal-brand">',
      '      <span class="pxk-legal-logo" aria-hidden="true">✶</span>',
      '      <span class="pxk-legal-title" data-i18n="legalOverlay.title"></span>',
      '    </div>',
      '    <button type="button" class="pxk-legal-close" data-legal-close="1" data-i18n="legalOverlay.close"></button>',
      "  </div>",

      '  <div class="pxk-legal-tabs" role="tablist">',
      '    <button type="button" class="pxk-legal-tab" role="tab" data-legal-mode="notice" aria-selected="true" data-i18n="legalOverlay.tabs.notice"></button>',
      '    <button type="button" class="pxk-legal-tab" role="tab" data-legal-mode="privacy" aria-selected="false" data-i18n="legalOverlay.tabs.privacy"></button>',
      '    <button type="button" class="pxk-legal-tab" role="tab" data-legal-mode="cookies" aria-selected="false" data-i18n="legalOverlay.tabs.cookies"></button>',
      "  </div>",

      '  <div class="pxk-legal-body" data-legal-body="1">',
      "    <section data-legal-section='notice'>",
      "      <h1 data-i18n='notice.title'></h1>",
      "      <p data-i18n='notice.body1'></p>",
      "      <p data-i18n='notice.body2'></p>",
      "      <h2 data-i18n='notice.ownerTitle'></h2>",
      "      <p data-i18n='notice.ownerBody'></p>",
	  "      <p class='muted small' data-i18n='legal.location'></p>",
      "      <h2 data-i18n='notice.contactTitle'></h2>",
      "      <p data-i18n='notice.contactBody'></p>",
      "    </section>",

      "    <section data-legal-section='privacy' hidden>",
      "      <h1 data-i18n='privacy.title'></h1>",
      "      <p data-i18n='privacy.body1'></p>",
      "      <p data-i18n='privacy.body2'></p>",
      "      <h2 data-i18n='privacy.purposeTitle'></h2>",
      "      <p data-i18n='privacy.purposeBody'></p>",
      "      <h2 data-i18n='privacy.legalBasisTitle'></h2>",
      "      <p data-i18n='privacy.legalBasisBody'></p>",
      "      <h2 data-i18n='privacy.retentionTitle'></h2>",
      "      <p data-i18n='privacy.retentionBody'></p>",
      "      <h2 data-i18n='privacy.rightsTitle'></h2>",
      "      <p data-i18n='privacy.rightsBody'></p>",
      "      <h2 data-i18n='privacy.securityTitle'></h2>",
      "      <p data-i18n='privacy.securityBody'></p>",
      "    </section>",

      "    <section data-legal-section='cookies' hidden>",
      "      <h1 data-i18n='cookies.title'></h1>",
      "      <p data-i18n='cookies.body1'></p>",
      "      <p data-i18n='cookies.body2'></p>",
      "      <p data-i18n='cookies.body3'></p>",
      "    </section>",
      "  </div>",
      "</div>"
    ].join("");

    document.body.appendChild(overlay);
    return overlay;
  }

  function getI18nRuntime() {
    // i18n.js in this project uses window.__pixkuyI18nRuntime
    // We do not invent: we rely on what i18n.js actually exposes.
    return window.__pixkuyI18nRuntime || null;
  }

  function applyI18nToOverlay(overlay) {
    var rt = getI18nRuntime();
    if (!rt || typeof rt.getCurrentLang !== "function" || typeof rt.getDict !== "function") return;

    var lang = rt.getCurrentLang();
    var dict = rt.getDict(lang);
    if (!dict) return;

    // Apply aria-label from i18n key (no literals)
    var ariaKey = overlay.getAttribute("data-i18n-aria");
    if (ariaKey && dict) {
      var val = rt.getByPath(dict, ariaKey);
      if (typeof val === "string" && val) overlay.setAttribute("aria-label", val);
    }

    // Apply translations inside overlay
    if (typeof rt.applyToRoot === "function") {
      rt.applyToRoot(overlay);
    }
  }

  function setOpen(overlay, open) {
    if (open) {
      overlay.setAttribute("data-open", "1");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add(BODY_LOCK_CLASS);

      applyI18nToOverlay(overlay);

      var closeBtn = overlay.querySelector("button[data-legal-close='1']");
      if (closeBtn) closeBtn.focus();
    } else {
      overlay.removeAttribute("data-open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove(BODY_LOCK_CLASS);
    }
  }

  function setMode(overlay, mode) {
    if (!mode) return;

    overlay.setAttribute("data-mode", mode);

    // Toggle sections
    var sections = overlay.querySelectorAll("[data-legal-section]");
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var secMode = sec.getAttribute("data-legal-section");
      sec.hidden = secMode !== mode;
    }

    // Toggle tabs state
    var tabs = overlay.querySelectorAll("[data-legal-mode]");
    for (var j = 0; j < tabs.length; j++) {
      var tab = tabs[j];
      var tabMode = tab.getAttribute("data-legal-mode");
      tab.setAttribute("aria-selected", tabMode === mode ? "true" : "false");
    }

    // Reset scroll to top for the legal body
    var body = overlay.querySelector("[data-legal-body='1']");
    if (body) body.scrollTop = 0;
  }

  function openOverlayForHref(href) {
    var mode = getModeFromHref(href);
    if (!mode) return;

    var overlay = ensureOverlay();
    setMode(overlay, mode);
    setOpen(overlay, true);
  }

  function closeOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    setOpen(overlay, false);
  }

  function handleKeydown(e) {
    if (e.key === "Escape") {
      var overlay = document.getElementById(OVERLAY_ID);
      if (overlay && overlay.getAttribute("data-open") === "1") {
        e.preventDefault();
        closeOverlay();
      }
    }
  }

  function delegateClick(e) {
    var target = e.target;
    if (!target) return;

    // Close (button/backdrop)
    var closeEl = target.closest && target.closest("[data-legal-close='1']");
    if (closeEl) {
      e.preventDefault();
      closeOverlay();
      return;
    }

    // Tabs
    var tabEl = target.closest && target.closest("[data-legal-mode]");
    if (tabEl) {
      e.preventDefault();
      var overlay = document.getElementById(OVERLAY_ID) || ensureOverlay();
      var mode = tabEl.getAttribute("data-legal-mode");
      setMode(overlay, mode);
      return;
    }

    // Intercept legal links only on landing (not inside /legal pages)
    var link = target.closest && target.closest("a[href]");
    if (!link) return;

    var href = link.getAttribute("href");
    if (!isLegalHref(href)) return;

    if (typeof location !== "undefined" && String(location.pathname).indexOf("/legal/") !== -1) return;

    var mode = getModeFromHref(href);
    if (!mode) return;

    e.preventDefault();
    openOverlayForHref(href);
  }

  function init() {
    document.addEventListener("click", delegateClick, { passive: false });
    document.addEventListener("keydown", handleKeydown);

    // Create overlay early (so first open is instant)
    ensureOverlay();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Public API (no literals)
  window.PixkuyLegalOverlay = {
    open: openOverlayForHref,
    close: closeOverlay
  };
})();
