/* assets/js/services/hourly-mobile-notes-editor.js
   Hourly / Daily mobile notes editor.
   Responsabilidad:
   - abrir una sábana móvil para Notas / Itinerario dentro de Hourly Mobile Route
   - sincronizar el textarea compacto con el textarea ampliado
   - conservar contenido al cerrar
   - permitir limpiar el contenido
   - no tocar desktop
   - no tocar #contact
   - no tocar hourly-daily-panel.js
*/

(function initHourlyMobileNotesEditor(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const BODY_SCREEN_ATTR = "data-hourly-mobile-screen";
  const NOTES_EDITOR_ACTIVE_ATTR = "data-hourly-mobile-notes-editor-active";

  const ROUTE_SELECTOR = ".hourly-mobile-route";
  const COMPACT_NOTES_SELECTOR =
    ".hourly-mobile-route .services-hourly-panel__field--notes textarea";

  const EDITOR_SELECTOR = "[data-hourly-mobile-notes-editor]";
  const EDITOR_INPUT_SELECTOR = "[data-hourly-mobile-notes-editor-input]";
  const EDITOR_CLOSE_SELECTOR = "[data-hourly-mobile-notes-editor-close]";
  const EDITOR_CLEAR_SELECTOR = "[data-hourly-mobile-notes-editor-clear]";

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let editorNode = null;
  let activeCompactInput = null;

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getI18nValue(path, fallback) {
    const modules = window.__pixkuyI18nModules || {};
    const getValue = modules.getValue;
    const dict = window.__pixkuyI18nDict || null;
    const parts = String(path || "").split(".");
    let cursor = dict;
    let index;
    let value;

    if (!path) {
      return fallback || "";
    }

    if (typeof getValue === "function" && dict) {
      value = getValue(dict, path);

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    for (index = 0; cursor && index < parts.length; index += 1) {
      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" && cursor.trim()
      ? cursor.trim()
      : (fallback || "");
  }

  function isHourlyMobileRouteActive() {
    return (
      isMobileViewport() &&
      document.body.getAttribute(BODY_SCREEN_ATTR) === "true"
    );
  }

  function getCompactNotesInput() {
    return document.querySelector(COMPACT_NOTES_SELECTOR);
  }

  function getEditorInput() {
    return editorNode
      ? editorNode.querySelector(EDITOR_INPUT_SELECTOR)
      : null;
  }

  function getEditorClear() {
    return editorNode
      ? editorNode.querySelector(EDITOR_CLEAR_SELECTOR)
      : null;
  }

  function dispatchInputEvents(input) {
    if (!input) {
      return false;
    }

    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.dispatchEvent(new window.Event("change", { bubbles: true }));

    return true;
  }

  function syncEditorClear() {
    const input = getEditorInput();
    const clear = getEditorClear();
    const hasValue = Boolean(normalizeText(input && input.value));

    if (!clear) {
      return false;
    }

    clear.hidden = !hasValue;
    clear.setAttribute("aria-hidden", hasValue ? "false" : "true");

    return true;
  }

  function syncCopy() {
    const title = editorNode
      ? editorNode.querySelector("[data-hourly-mobile-notes-editor-title]")
      : null;
    const close = editorNode
      ? editorNode.querySelector(EDITOR_CLOSE_SELECTOR)
      : null;
    const clear = editorNode
      ? editorNode.querySelector(EDITOR_CLEAR_SELECTOR)
      : null;
    const input = getEditorInput();

    const titleText = getI18nValue(
      "services.cards.hourly.panel.notesLabel",
      ""
    );
    const closeText = getI18nValue(
      "services.cards.airport.panel.back",
      "Volver"
    );
    const clearText = getI18nValue(
      "services.cards.airport.panel.clearResolvedDestination",
      ""
    );
    const placeholderText = getI18nValue(
      "services.cards.hourly.panel.notesPlaceholder",
      ""
    );

    if (title) {
      title.textContent = titleText;
    }

    if (close) {
      close.textContent = closeText;
      close.setAttribute("aria-label", closeText);
    }

    if (clear) {
      clear.setAttribute("aria-label", clearText || "Limpiar");
    }

    if (input) {
      input.setAttribute("placeholder", placeholderText);
      input.setAttribute("aria-label", titleText);
    }

    return true;
  }

  function buildEditorNode() {
    const editor = document.createElement("section");
    const panel = document.createElement("div");
    const header = document.createElement("div");
    const title = document.createElement("p");
    const close = document.createElement("button");
    const body = document.createElement("div");
    const textarea = document.createElement("textarea");
    const clear = document.createElement("button");

    editor.className = "hourly-mobile-notes-editor";
    editor.setAttribute("data-hourly-mobile-notes-editor", "1");
    editor.setAttribute("aria-hidden", "true");
    editor.hidden = true;

    panel.className = "hourly-mobile-notes-editor__panel";

    header.className = "hourly-mobile-notes-editor__header";

    title.className = "hourly-mobile-notes-editor__title";
    title.setAttribute("data-hourly-mobile-notes-editor-title", "1");

    close.type = "button";
    close.className = "hourly-mobile-notes-editor__close";
    close.setAttribute("data-hourly-mobile-notes-editor-close", "1");

    body.className = "hourly-mobile-notes-editor__body";

    textarea.className = "hourly-mobile-notes-editor__input";
    textarea.rows = 8;
    textarea.setAttribute("data-hourly-mobile-notes-editor-input", "1");

    clear.type = "button";
    clear.className = "hourly-mobile-notes-editor__clear";
    clear.setAttribute("data-hourly-mobile-notes-editor-clear", "1");
    clear.hidden = true;
    clear.setAttribute("aria-hidden", "true");
    clear.innerHTML = '<span aria-hidden="true">×</span>';

    header.appendChild(title);
    header.appendChild(close);

    body.appendChild(textarea);
    body.appendChild(clear);

    panel.appendChild(header);
    panel.appendChild(body);

    editor.appendChild(panel);

    return editor;
  }

  function ensureEditorNode() {
    if (editorNode) {
      return editorNode;
    }

    editorNode = document.querySelector(EDITOR_SELECTOR);

    if (!editorNode) {
      editorNode = buildEditorNode();
      document.body.appendChild(editorNode);
    }

    bindEditorEvents();
    syncCopy();

    return editorNode;
  }

  function syncCompactToEditor() {
    const editorInput = getEditorInput();

    if (!activeCompactInput || !editorInput) {
      return false;
    }

    editorInput.value = activeCompactInput.value || "";
    syncEditorClear();

    return true;
  }

  function syncEditorToCompact() {
    const editorInput = getEditorInput();

    if (!activeCompactInput || !editorInput) {
      return false;
    }

    activeCompactInput.value = editorInput.value || "";
    dispatchInputEvents(activeCompactInput);

    return true;
  }

  function openEditor(compactInput) {
    const editor = ensureEditorNode();
    const editorInput = getEditorInput();

    if (!isHourlyMobileRouteActive() || !compactInput || !editor || !editorInput) {
      return false;
    }

    activeCompactInput = compactInput;
    syncCompactToEditor();

    editor.hidden = false;
    editor.setAttribute("aria-hidden", "false");
    document.body.setAttribute(NOTES_EDITOR_ACTIVE_ATTR, "true");

    window.requestAnimationFrame(function focusEditorInput() {
      editorInput.focus({ preventScroll: true });
      editorInput.setSelectionRange(editorInput.value.length, editorInput.value.length);
    });

    return true;
  }

  function closeEditor() {
    const editor = ensureEditorNode();

    if (!editor) {
      return false;
    }

    syncEditorToCompact();

    editor.hidden = true;
    editor.setAttribute("aria-hidden", "true");
    document.body.setAttribute(NOTES_EDITOR_ACTIVE_ATTR, "false");

    if (activeCompactInput && typeof activeCompactInput.focus === "function") {
      activeCompactInput.focus({ preventScroll: true });
    }

    activeCompactInput = null;

    return true;
  }

  function isEditorOpen() {
    return Boolean(
      editorNode &&
      editorNode.hidden !== true &&
      editorNode.getAttribute("aria-hidden") !== "true"
    );
  }

  function bindEditorEvents() {
    if (!editorNode || editorNode.dataset.hourlyMobileNotesEditorBound === "1") {
      return false;
    }

    editorNode.dataset.hourlyMobileNotesEditorBound = "1";

    editorNode.addEventListener("click", function onEditorClick(event) {
      const close = event.target.closest(EDITOR_CLOSE_SELECTOR);
      const clear = event.target.closest(EDITOR_CLEAR_SELECTOR);
      const input = getEditorInput();

      if (close) {
        event.preventDefault();
        closeEditor();
        return;
      }

      if (!clear) {
        return;
      }

      event.preventDefault();

      if (input) {
        input.value = "";
        syncEditorToCompact();
        syncEditorClear();
        input.focus({ preventScroll: true });
      }
    });

    const input = getEditorInput();

    if (input) {
      input.addEventListener("input", function onEditorInput() {
        syncEditorToCompact();
        syncEditorClear();
      });
    }

    return true;
  }

  function bindCompactDelegates() {
    document.addEventListener("focusin", function onCompactFocus(event) {
      const target = event.target;

      if (!target || !target.matches || !target.matches(COMPACT_NOTES_SELECTOR)) {
        return;
      }

      if (!isHourlyMobileRouteActive()) {
        return;
      }

      openEditor(target);
    });

    document.addEventListener("click", function onCompactClick(event) {
      const target = event.target;

      if (!target || !target.matches || !target.matches(COMPACT_NOTES_SELECTOR)) {
        return;
      }

      if (!isHourlyMobileRouteActive()) {
        return;
      }

      event.preventDefault();
      openEditor(target);
    });

    document.addEventListener("keydown", function onKeydown(event) {
      if (event.key !== "Escape" || !isEditorOpen()) {
        return;
      }

      event.preventDefault();
      closeEditor();
    });

    return true;
  }

  function syncActiveState() {
    if (!isHourlyMobileRouteActive() && isEditorOpen()) {
      closeEditor();
    }

    return true;
  }

  function init() {
    ensureEditorNode();
    bindCompactDelegates();
    syncActiveState();

    window.addEventListener("resize", syncActiveState);
    window.addEventListener("pageshow", syncActiveState);
    window.addEventListener("pixkuy:i18n-applied", syncCopy);

    if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", syncActiveState);
    } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(syncActiveState);
    }

    return true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.PixkuyHourlyMobileNotesEditor = {
    open: openEditor,
    close: closeEditor,
    isOpen: isEditorOpen,
    syncCopy: syncCopy
  };
})(window, document);