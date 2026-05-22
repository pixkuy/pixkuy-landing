/* assets/js/forms/legal-acceptance.js
   Legal acceptance UI and hidden-field sync.
   Responsabilidad:
   - montar aceptación explícita de Términos + Cancelaciones + Privacidad
   - sincronizar hidden fields legal_acceptance_* del formulario
   - exponer API reutilizable para flujos desktop/mobile
   - no enviar formularios, no llamar a Booking API, no tocar Stripe
*/

(function initPixkuyLegalAcceptance(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  var FORMS_NAMESPACE = (window.PixkuyForms = window.PixkuyForms || {});
  var TERMS_URL = "legal/terms.html";
  var CANCELLATIONS_URL = "legal/cancellations.html";
  var PRIVACY_URL = "legal/privacy.html";
  var DEFAULT_CHANNEL = "web_checkout";
  var DEFAULT_TERMS_VERSION = "terms_v1_2026_05";
  var DEFAULT_CANCELLATIONS_VERSION = "cancellation_policy_v1_2026_05";
  var DEFAULT_PRIVACY_VERSION = "privacy_v1_2026_05";

  var FIELD_NAMES = {
    accepted: "legal_acceptance_accepted",
    termsVersion: "legal_acceptance_terms_version",
    cancellationsVersion: "legal_acceptance_cancellation_policy_version",
    privacyVersion: "legal_acceptance_privacy_version",
    acceptedAt: "legal_acceptance_accepted_at",
    channel: "legal_acceptance_channel",
    termsUrl: "legal_acceptance_terms_url",
    cancellationsUrl: "legal_acceptance_cancellations_url",
    privacyUrl: "legal_acceptance_privacy_url"
  };

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getI18nRuntime() {
    return window.__pixkuyI18nRuntime || null;
  }

  function getI18nDict() {
    var runtime = getI18nRuntime();
    var lang = runtime && typeof runtime.getCurrentLang === "function"
      ? runtime.getCurrentLang()
      : "";
    var runtimeDict = runtime && typeof runtime.getDict === "function"
      ? runtime.getDict(lang)
      : null;

    if (window.__pixkuyI18nDict && typeof window.__pixkuyI18nDict === "object") {
      return window.__pixkuyI18nDict;
    }

    return runtimeDict || null;
  }

  function getByPath(source, path) {
    var parts;
    var cursor;
    var index;

    if (!source || !path) {
      return "";
    }

    parts = String(path).split(".");
    cursor = source;

    for (index = 0; index < parts.length; index += 1) {
      if (!cursor || typeof cursor !== "object") {
        return "";
      }

      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" ? cursor : "";
  }

  function getCopy(path, fallback) {
    var dict = getI18nDict();
    var value = getByPath(dict, path);

    return normalizeText(value) || fallback || "";
  }

  function getVersions() {
    return {
      terms: getCopy("terms.policyVersion", DEFAULT_TERMS_VERSION),
      cancellations: getCopy("cancellations.policyVersion", DEFAULT_CANCELLATIONS_VERSION),
      privacy: getCopy("legal.privacyPolicyVersion", DEFAULT_PRIVACY_VERSION)
    };
  }

  function getField(form, name) {
    if (!form || !name || typeof form.querySelector !== "function") {
      return null;
    }

    return form.querySelector("[name='" + name + "']");
  }

  function setFieldValue(form, name, value) {
    var field = getField(form, name);

    if (!field) {
      return false;
    }

    field.value = normalizeText(value);
    return true;
  }

  function clearFields(form) {
    Object.keys(FIELD_NAMES).forEach(function clearField(key) {
      setFieldValue(form, FIELD_NAMES[key], "");
    });
  }

  function buildSnapshot(channel) {
    var versions = getVersions();

    return {
      accepted: "true",
      termsVersion: versions.terms,
      cancellationsVersion: versions.cancellations,
      privacyVersion: versions.privacy,
      acceptedAt: new Date().toISOString(),
      channel: normalizeText(channel) || DEFAULT_CHANNEL,
      termsUrl: TERMS_URL,
      cancellationsUrl: CANCELLATIONS_URL,
      privacyUrl: PRIVACY_URL
    };
  }

  function syncAcceptedFields(form, snapshot) {
    if (!form || !snapshot) {
      return false;
    }

    setFieldValue(form, FIELD_NAMES.accepted, snapshot.accepted);
    setFieldValue(form, FIELD_NAMES.termsVersion, snapshot.termsVersion);
    setFieldValue(form, FIELD_NAMES.cancellationsVersion, snapshot.cancellationsVersion);
    setFieldValue(form, FIELD_NAMES.privacyVersion, snapshot.privacyVersion);
    setFieldValue(form, FIELD_NAMES.acceptedAt, snapshot.acceptedAt);
    setFieldValue(form, FIELD_NAMES.channel, snapshot.channel);
    setFieldValue(form, FIELD_NAMES.termsUrl, snapshot.termsUrl);
    setFieldValue(form, FIELD_NAMES.cancellationsUrl, snapshot.cancellationsUrl);
    setFieldValue(form, FIELD_NAMES.privacyUrl, snapshot.privacyUrl);

    return true;
  }

  function getFormFromOptions(options, container) {
    var form = options && options.form ? options.form : null;

    if (form && form.nodeType === 1) {
      return form;
    }

    if (container && typeof container.closest === "function") {
      return container.closest("form");
    }

    return document.querySelector("form[name='contact']");
  }

  function createTextNode(text) {
    return document.createTextNode(normalizeText(text));
  }

  function createPolicyLink(href, text) {
    var link = document.createElement("a");

    link.href = href;
    link.textContent = normalizeText(text);
    link.setAttribute("target", "_self");

    return link;
  }

  function createLegalAcceptance(options) {
    var config = options || {};
    var container = config.container || null;
    var form = getFormFromOptions(config, container);
    var channel = normalizeText(config.channel) || DEFAULT_CHANNEL;
    var root;
    var checkboxId;
    var checkbox;
    var error;
    var latestSnapshot = null;

    if (!container || container.nodeType !== 1) {
      throw new Error("LEGAL_ACCEPTANCE_CONTAINER_REQUIRED");
    }

    if (!form || form.nodeType !== 1) {
      throw new Error("LEGAL_ACCEPTANCE_FORM_REQUIRED");
    }

    checkboxId = normalizeText(config.checkboxId) || "pixkuy-legal-acceptance-checkbox";

    clearFields(form);
    container.innerHTML = "";

    root = document.createElement("div");
    root.className = "legal-acceptance";
    root.setAttribute("data-legal-acceptance", "1");

    checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = checkboxId;
    checkbox.className = "legal-acceptance__checkbox";
    checkbox.setAttribute("data-legal-acceptance-checkbox", "1");

    error = document.createElement("p");
    error.className = "form-error legal-acceptance__error";
    error.hidden = true;
    error.setAttribute("role", "alert");
    error.setAttribute("data-legal-acceptance-error", "1");
    error.textContent = getCopy(
      "terms.acceptance.error",
      "Debes aceptar las condiciones legales para continuar al pago."
    );

    root.appendChild(checkbox);

    var label = document.createElement("label");
    label.className = "legal-acceptance__label";
    label.setAttribute("for", checkboxId);
    label.appendChild(createTextNode(getCopy(
      "terms.acceptance.checkbox",
      "He leído y acepto los Términos y condiciones, la Política de cancelación, cambios y reembolsos y el Aviso de privacidad de Pixkuy."
    )));
    root.appendChild(label);

    var links = document.createElement("div");
    links.className = "legal-acceptance__links";

    links.appendChild(createPolicyLink(
      TERMS_URL,
      getCopy("terms.acceptance.viewTerms", "Ver Términos")
    ));
    links.appendChild(createTextNode(" · "));
    links.appendChild(createPolicyLink(
      CANCELLATIONS_URL,
      getCopy("terms.acceptance.viewCancellations", "Ver Cancelaciones")
    ));
    links.appendChild(createTextNode(" · "));
    links.appendChild(createPolicyLink(
      PRIVACY_URL,
      getCopy("terms.acceptance.viewPrivacy", "Ver Privacidad")
    ));

    root.appendChild(links);
    root.appendChild(error);
    container.appendChild(root);

    function setErrorVisible(visible) {
      error.hidden = !visible;
      checkbox.setAttribute("aria-invalid", visible ? "true" : "false");
    }

    function syncState() {
      if (!checkbox.checked) {
        latestSnapshot = null;
        clearFields(form);
        return null;
      }

      latestSnapshot = buildSnapshot(channel);
      syncAcceptedFields(form, latestSnapshot);
      return latestSnapshot;
    }

    checkbox.addEventListener("change", function onAcceptanceChange() {
      setErrorVisible(false);
      syncState();
    });

    return {
      root: root,
      checkbox: checkbox,
      error: error,

      isAccepted: function isAccepted() {
        return checkbox.checked === true;
      },

      getSnapshot: function getSnapshot() {
        return latestSnapshot;
      },

      sync: function sync() {
        return syncState();
      },

      validate: function validate() {
        if (checkbox.checked) {
          setErrorVisible(false);
          syncState();
          return true;
        }

        clearFields(form);
        setErrorVisible(true);
        checkbox.focus();
        return false;
      },

      destroy: function destroy() {
        clearFields(form);
        container.innerHTML = "";
      }
    };
  }

  FORMS_NAMESPACE.LegalAcceptance = {
    create: createLegalAcceptance,
    buildSnapshot: buildSnapshot,
    syncAcceptedFields: syncAcceptedFields,
    clearFields: clearFields,
    fieldNames: FIELD_NAMES
  };
})(window, document);