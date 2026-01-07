/* assets/js/i18n.js */

const SUPPORTED_LANGS = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
  { code: "fr", label: "FR" },
  { code: "pt", label: "PT" },
  { code: "it", label: "IT" },
  { code: "de", label: "DE" },
  { code: "ko", label: "KO" },
  { code: "zh-hans", label: "中文" }
];

/**
 * Catálogo de idiomas para el selector.
 * Nota: los nombres de idioma se muestran en su idioma nativo (no se “traducen”).
 */
const LANGUAGE_CATALOG = {
  es: { short: "ES", label: "Español" },
  en: { short: "EN", label: "English" },
  ru: { short: "RU", label: "Русский" },
  fr: { short: "FR", label: "Français" },
  pt: { short: "PT", label: "Português" },
  it: { short: "IT", label: "Italiano" },
  de: { short: "DE", label: "Deutsch" },
  ko: { short: "KO", label: "한국어" },
  "zh-hans": { short: "中文", label: "中文（简体）" }
};

// Aliases y normalización hacia códigos canónicos
const LANG_ALIASES = {
  // Chinese (simplified)
  "zh-hans": "zh-hans",
  "zh_hans": "zh-hans",
  "zh-hans-cn": "zh-hans",
  "zh_cn": "zh-hans",
  "zh-cn": "zh-hans",
  // Korean
  "ko-kr": "ko",
  // Portuguese (agrupado a pt para landing)
  "pt-br": "pt",
  "pt-pt": "pt",
  // English (agrupado a en)
  "en-us": "en",
  "en-gb": "en",
  "en-ca": "en",
  // Spanish (agrupado a es)
  "es-mx": "es",
  "es-es": "es",
  "es-co": "es",
  "es-ar": "es",
  // Russian
  "ru-ru": "ru",
  // French (agrupado a fr)
  "fr-fr": "fr",
  "fr-ca": "fr",
  // Italian / German (por completitud)
  "it-it": "it",
  "de-de": "de"
};

function normalizeLangCode(raw) {
  if (!raw || typeof raw !== "string") return null;

  const s = raw.trim().toLowerCase().replace(/_/g, "-");

  if (LANG_ALIASES[s]) return LANG_ALIASES[s];

  const base = s.split("-")[0];
  if (!base) return null;

  const isSupported = SUPPORTED_LANGS.some((l) => l.code === base);
  if (isSupported) return base;

  return null;
}

/**
 * Fallback de emergencia SOLO en ES.
 * Objetivo: si falla la carga de JSON (red/ruta/hosting), la landing NO queda vacía.
 * EN/RU/etc deben venir de assets/i18n/<lang>.json
 */
const FALLBACK_ES = {
  ui: {
    language: "Idioma"
  },
  hero: {
    title: "Movilidad privada con conductor, sin concesiones.",
    subtitle:
      "Conductores seleccionados. Vehículos eléctricos premium.<br>Un estándar consistente para quienes no improvisan su movilidad en Ciudad de México.",
    cta: "Solicitar invitación",
    note: "Acceso limitado · Lanzamiento marzo de 2026"
  },
  local: {
    title: "Ciudad de México, sin fricción.",
    body:
      "Rutas limpias, tiempos controlados y un estándar consistente. Pensado para trabajo, viajes y ocasiones especiales."
  },
  standard: {
    title: "Un estándar pensado para el silencio.",
    subtitle: "Movilidad eléctrica de alta gama.<br>Espacio. Calma. Continuidad."
  },
  services: {
    title: "No todas las necesidades son iguales.",
    item1: "Traslados privados planificados.",
    item2: "Servicios por horas o por días, con continuidad.",
    item3: "Eventos y ocasiones que requieren precisión.",
    item4: "Escapadas cercanas sin fricciones logísticas.",
    bridge:
      "Pixkuy está pensado para quienes valoran la planificación, la discreción y un estándar estable de servicio."
  },
  contact: {
    title: "Mantente informado.",
    subtitle: "Lanzamiento previsto en marzo de 2026.",
    name: "Nombre",
    email: "Email",
    phone: "Teléfono",
    msg: "Ej. evento en 2026, traslado planificado…",
    submit: "Enviar solicitud",
    footer: "Servicio no operativo aún · Solo avisos relevantes"
  },
  legal: {
    tagline: "Movilidad privada con conductor, sin concesiones.",
    location: "Ciudad de México, México.",
    contact: "Contacto exclusivamente mediante el formulario de esta web.",
    links: {
      notice: "Aviso legal",
      privacy: "Privacidad",
      cookies: "Cookies"
    },
    notice: {
      title: "Aviso legal",
      provider: "Titular: Pixkuy Mobility S.A. de C.V.",
      purposeTitle: "Objeto",
      purposeBody:
        "Este sitio web tiene como finalidad informar sobre Pixkuy Mobility y permitir que las personas interesadas soliciten ser contactadas mediante el formulario.",
      conditionsTitle: "Condiciones de uso",
      conditionsBody:
        "El acceso y uso de este sitio implica la aceptación de estas condiciones. El titular podrá actualizar contenidos y condiciones cuando sea necesario.",
      ipTitle: "Propiedad intelectual e industrial",
      ipBody:
        "Los contenidos, marcas, diseño e identidad visual de este sitio están protegidos. No se permite su reproducción o distribución sin autorización.",
      liabilityTitle: "Responsabilidad",
      liabilityBody:
        "El titular no se hace responsable de interrupciones temporales del servicio ni de daños derivados de un uso indebido del sitio.",
      back: "Volver a la landing"
    },
    privacy: {
      title: "Política de privacidad",
      controllerTitle: "Responsable del tratamiento",
      controllerBody: "Responsable: Pixkuy Mobility S.A. de C.V.",
      dataTitle: "Datos que se recogen",
      dataBody:
        "A través del formulario se recogen los datos que la persona introduce (p. ej. nombre, email, teléfono y mensaje).",
      purposeTitle: "Finalidad",
      purposeBody:
        "Gestionar solicitudes de contacto, mantener informadas a las personas interesadas y atender comunicaciones relacionadas con el servicio.",
      legalBasisTitle: "Base legal",
      legalBasisBody: "Consentimiento de la persona interesada al enviar el formulario.",
      retentionTitle: "Conservación",
      retentionBody:
        "Los datos se conservarán el tiempo necesario para atender la solicitud y, en su caso, para comunicaciones relacionadas, salvo obligación legal distinta.",
      rightsTitle: "Derechos",
      rightsBody:
        "Puedes solicitar acceso, rectificación o supresión, así como otros derechos aplicables conforme a la normativa vigente. Para ejercerlos, utiliza el formulario de esta web indicando tu solicitud.",
      securityTitle: "Seguridad",
      securityBody: "Se aplican medidas razonables para proteger los datos frente a accesos no autorizados.",
      back: "Volver a la landing"
    },
    cookies: {
      title: "Política de cookies",
      body1: "Este sitio no utiliza cookies con fines publicitarios ni de seguimiento.",
      body2:
        "Si en el futuro se incorporaran cookies, se informará y, cuando corresponda, se solicitará consentimiento.",
      body3: "La preferencia de idioma puede almacenarse localmente en el navegador para mejorar la experiencia.",
      back: "Volver a la landing"
    }
  }
};

// --- Loader JSON ---

// IMPORTANTE: base absoluta para funcionar también en /legal/*
const I18N_JSON_BASE = "/assets/i18n";
const translationsCache = new Map();
let applySeq = 0;

// --- Lang selector overlay (premium UX) ---

const LANG_OVERLAY_ID = "lang-overlay";

function getOrCreateLangOverlay() {
  const existing = document.getElementById(LANG_OVERLAY_ID);
  if (existing) return existing;

  const overlay = document.createElement("div");
  overlay.id = LANG_OVERLAY_ID;
  overlay.setAttribute("aria-hidden", "true");

  // Inline styles para NO depender de CSS (evita otro fichero)
  overlay.style.position = "fixed";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.background = "rgba(0,0,0,0.35)";
  overlay.style.backdropFilter = "blur(2px)";
  overlay.style.webkitBackdropFilter = "blur(2px)";
  overlay.style.zIndex = "19"; // justo por debajo de .lang (que va a 20)
  overlay.style.display = "none";

  document.body.appendChild(overlay);
  return overlay;
}

function setLangOverlayVisible(visible) {
  const overlay = getOrCreateLangOverlay();
  overlay.style.display = visible ? "block" : "none";

  // Bloqueo scroll del body (sin clase CSS adicional)
  document.body.style.overflow = visible ? "hidden" : "";
}

function isDevHost() {
  if (typeof location === "undefined") return false;
  return (
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname.endsWith(".test")
  );
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadTranslationsForLang(lang) {
  if (!lang) return null;

  if (translationsCache.has(lang)) {
    return translationsCache.get(lang);
  }

  const url = `${I18N_JSON_BASE}/${encodeURIComponent(lang)}.json`;
  try {
    const json = await fetchJson(url);
    translationsCache.set(lang, json);
    return json;
  } catch (err) {
    if (lang === "es") {
      if (isDevHost()) {
        console.warn("[i18n] ES JSON not available, using embedded ES fallback", {
          lang,
          url,
          err: String(err && err.message ? err.message : err)
        });
      }
      translationsCache.set("es", FALLBACK_ES);
      return FALLBACK_ES;
    }

    if (isDevHost()) {
      console.warn("[i18n] JSON not available (no embedded fallback for this lang)", {
        lang,
        url,
        err: String(err && err.message ? err.message : err)
      });
    }
    return null;
  }
}

function detectLang() {
  if (typeof location !== "undefined") {
    const params = new URLSearchParams(location.search);
    const fromUrlRaw = params.get("lang");
    const fromUrl = normalizeLangCode(fromUrlRaw);
    if (fromUrl) return fromUrl;
  }

  const savedRaw = localStorage.getItem("lang");
  const saved = normalizeLangCode(savedRaw);
  if (saved) return saved;

  const browserRaw = navigator.language || "es";
  const browser = normalizeLangCode(browserRaw);
  if (browser) return browser;

  return "es";
}

function getValue(dict, path) {
  const parts = path.split(".");
  let v = dict;
  for (const k of parts) v = v && v[k];
  return v;
}

/**
 * Selector de idioma “pro”.
 * - Si existe estructura nueva (trigger + menu vacío), se renderiza dinámicamente.
 * - Si no existe, se mantiene compat con botones legacy (3 botones data-lang).
 */
function getLangDom() {
  const nav = document.querySelector(".lang");
  if (!nav) return null;

  const trigger = document.getElementById("lang-trigger");
  const current = nav.querySelector(".lang-current");
  const menu = nav.querySelector(".lang-menu");

  const isPro = !!(trigger && current && menu);
  const legacyButtons = Array.from(nav.querySelectorAll("[data-lang]"));

  return { nav, isPro, trigger, current, menu, legacyButtons };
}

function buildMenuItems(langDom) {
  if (!langDom || !langDom.isPro) return;

  const allowed = SUPPORTED_LANGS.map((l) => l.code);

  langDom.menu.innerHTML = "";

  for (const code of allowed) {
    const meta = LANGUAGE_CATALOG[code] || { short: code.toUpperCase(), label: code };

    const li = document.createElement("li");
    li.setAttribute("role", "none");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "menuitemradio");
    btn.setAttribute("data-lang", code);
    btn.setAttribute("aria-checked", "false");
    btn.textContent = meta.label;

    li.appendChild(btn);
    langDom.menu.appendChild(li);
  }
}

function setMenuOpen(langDom, open) {
  if (!langDom || !langDom.isPro) return;

  langDom.trigger.setAttribute("aria-expanded", open ? "true" : "false");
  langDom.menu.hidden = !open;

  // Overlay + scroll lock solo si está abierto
  setLangOverlayVisible(open);
}

function updateLangUI(activeLang) {
  const langDom = getLangDom();
  if (!langDom) return;

  // A11y base
  langDom.nav.setAttribute("role", "group");
  langDom.nav.setAttribute("aria-label", "Language selector");

  // Pro selector
  if (langDom.isPro) {
    const meta = LANGUAGE_CATALOG[activeLang] || { short: activeLang.toUpperCase(), label: activeLang };

    // Rellena etiqueta visible (no literal en HTML)
    langDom.current.textContent = meta.short;

    // Marca items
    langDom.menu.querySelectorAll("[data-lang]").forEach((b) => {
      const isActive = b.getAttribute("data-lang") === activeLang;
      b.setAttribute("aria-checked", isActive ? "true" : "false");
    });

    // Cierra si estaba abierto al aplicar idioma
    setMenuOpen(langDom, false);
    return;
  }

  // Legacy selector (botones directos)
  langDom.legacyButtons.forEach((b) => {
    const isActive = b.dataset.lang === activeLang;
    b.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function initLangSelector() {
  const langDom = getLangDom();
  if (!langDom) return;

  // Si hay pro-structure, construimos items si aún no están
  if (langDom.isPro) {
    buildMenuItems(langDom);

    // Asegura overlay y click-to-close
    const overlay = getOrCreateLangOverlay();
    overlay.addEventListener("click", () => {
      setMenuOpen(langDom, false);
      langDom.trigger.focus();
    });

    // Toggle open/close
    langDom.trigger.addEventListener("click", () => {
      const open = langDom.trigger.getAttribute("aria-expanded") === "true";
      setMenuOpen(langDom, !open);

      if (!open) {
        const first = langDom.menu.querySelector("[data-lang]");
        if (first) first.focus();
      }
    });

    // Click fuera para cerrar (por seguridad adicional)
    document.addEventListener("click", (e) => {
      const open = langDom.trigger.getAttribute("aria-expanded") === "true";
      if (!open) return;

      if (!langDom.nav.contains(e.target) && e.target !== overlay) {
        setMenuOpen(langDom, false);
      }
    });

    // Escape para cerrar
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const open = langDom.trigger.getAttribute("aria-expanded") === "true";
        if (open) {
          setMenuOpen(langDom, false);
          langDom.trigger.focus();
        }
      }
    });

    // Delegación click items
    langDom.menu.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("[data-lang]") : null;
      if (!btn) return;
      const code = btn.getAttribute("data-lang");
      applyLang(code);
    });

    // Navegación teclado básica en menú
    langDom.menu.addEventListener("keydown", (e) => {
      const items = Array.from(langDom.menu.querySelectorAll("[data-lang]"));
      if (!items.length) return;

      const idx = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[(idx + 1 + items.length) % items.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (e.key === "Enter" || e.key === " ") {
        // Space/Enter selecciona
        e.preventDefault();
        const el = document.activeElement;
        if (el && el.getAttribute && el.getAttribute("data-lang")) {
          applyLang(el.getAttribute("data-lang"));
        }
      }
    });

    return;
  }

  // Legacy: click directo
  langDom.legacyButtons.forEach((b) => {
    b.onclick = () => applyLang(b.dataset.lang);
  });
}

async function applyLang(lang) {
  const seq = ++applySeq;

  const normalized = normalizeLangCode(lang) || "es";
  let dict = await loadTranslationsForLang(normalized);

  if (seq !== applySeq) return;

  if (!dict) {
    if (isDevHost()) {
      console.warn("[i18n] Falling back to ES because dict could not be loaded", {
        requested: normalized
      });
    }
    dict = await loadTranslationsForLang("es");
  }

  const finalLang = dict && normalized !== "es" ? normalized : "es";
  const finalDict = dict || FALLBACK_ES;

  document.documentElement.lang = finalLang;
  localStorage.setItem("lang", finalLang);

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    const v = getValue(finalDict, key);

    if (typeof v === "string") {
      el.innerHTML = v;
      return;
    }

    if (isDevHost()) {
      if (v === undefined) {
        console.warn("[i18n] Missing key", { lang: finalLang, key, el });
      } else {
        console.warn("[i18n] Non-string value for key", {
          lang: finalLang,
          key,
          valueType: typeof v,
          el
        });
      }
    }
  });

  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const key = el.dataset.i18nPh;
    const v = getValue(finalDict, key);

    if (typeof v === "string") {
      el.placeholder = v;
      return;
    }

    if (isDevHost()) {
      if (v === undefined) {
        console.warn("[i18n] Missing placeholder key", { lang: finalLang, key, el });
      } else {
        console.warn("[i18n] Non-string placeholder value for key", {
          lang: finalLang,
          key,
          valueType: typeof v,
          el
        });
      }
    }
  });

  // Actualiza UI del selector (pro o legacy)
  updateLangUI(finalLang);
}

(async function bootstrapI18n() {
  // Inicializa selector (pro si existe, legacy si no)
  initLangSelector();

  // Aplica idioma inicial (esto también setea UI)
  const lang = detectLang();
  await applyLang(lang);
})();
