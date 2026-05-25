/* assets/js/forms/recaptcha-enterprise.js
   reCAPTCHA Enterprise client helper.
   Responsabilidad:
   - leer la site key configurada en PIXKUY_BOOKING_API_CONFIG
   - ejecutar grecaptcha.enterprise con una action explícita
   - devolver token normalizado o cadena vacía si no está disponible
   - no decidir si el checkout debe fallar: esa responsabilidad es del backend
*/

(function initPixkuyRecaptchaEnterprise(window) {
  "use strict";

  if (!window) {
    return;
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getConfig() {
    var config = window.PIXKUY_BOOKING_API_CONFIG;

    return config && typeof config === "object" ? config : {};
  }

  function getSiteKey() {
    return normalizeText(getConfig().recaptchaSiteKey);
  }

  function getEnterpriseApi() {
    var grecaptcha = window.grecaptcha;

    if (!grecaptcha || !grecaptcha.enterprise) {
      return null;
    }

    return grecaptcha.enterprise;
  }

  function buildScriptSrc(siteKey) {
    return "https://www.google.com/recaptcha/enterprise.js?render=" + encodeURIComponent(siteKey);
  }

  function findExistingScript(siteKey) {
    var expectedSrc = buildScriptSrc(siteKey);
    var scripts = Array.prototype.slice.call(
      window.document.querySelectorAll("script[src]")
    );

    return scripts.find(function findScript(script) {
      return script.src === expectedSrc;
    }) || null;
  }

  function loadEnterpriseScript(siteKey) {
    var existing = findExistingScript(siteKey);

    if (getEnterpriseApi()) {
      return Promise.resolve(getEnterpriseApi());
    }

    if (existing) {
      return new Promise(function resolveExistingScript(resolve) {
        existing.addEventListener("load", function onExistingLoad() {
          resolve(getEnterpriseApi());
        }, { once: true });

        existing.addEventListener("error", function onExistingError() {
          resolve(null);
        }, { once: true });
      });
    }

    return new Promise(function resolveScript(resolve) {
      var script = window.document.createElement("script");

      script.src = buildScriptSrc(siteKey);
      script.async = true;
      script.defer = true;

      script.addEventListener("load", function onLoad() {
        resolve(getEnterpriseApi());
      }, { once: true });

      script.addEventListener("error", function onError() {
        resolve(null);
      }, { once: true });

      window.document.head.appendChild(script);
    });
  }

  function waitForEnterpriseReady(enterprise) {
    if (!enterprise || typeof enterprise.ready !== "function") {
      return Promise.resolve(enterprise);
    }

    return new Promise(function resolveWhenReady(resolve) {
      enterprise.ready(function onEnterpriseReady() {
        resolve(enterprise);
      });
    });
  }

  function execute(action) {
    var siteKey = getSiteKey();
    var safeAction = normalizeText(action);

    if (!siteKey || !safeAction) {
      return Promise.resolve("");
    }

    return loadEnterpriseScript(siteKey)
      .then(waitForEnterpriseReady)
      .then(function executeToken(readyEnterprise) {
        if (
          !readyEnterprise ||
          typeof readyEnterprise.execute !== "function"
        ) {
          return "";
        }

        return readyEnterprise.execute(siteKey, {
          action: safeAction
        });
      })
      .then(function normalizeToken(token) {
        return normalizeText(token);
      })
      .catch(function handleTokenError() {
        return "";
      });
  }

  window.PixkuyRecaptchaEnterprise = {
    execute: execute
  };
})(window);