/* assets/js/services/hourly-mobile-price-format.js
   Hourly / Daily mobile price formatter.
   Responsabilidad:
   - formatear visualmente la tarifa móvil Hourly como importe + moneda
   - leer el texto ya renderizado por hourly-daily-panel.js
   - no calcular precio
   - no modificar payload
   - no tocar hourly-daily-panel.js
   - no tocar desktop
*/

(function initHourlyMobilePriceFormat(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const BODY_SCREEN_ATTR = "data-hourly-mobile-screen";

  const PRICE_FIELD_SELECTOR =
    ".hourly-mobile-route .services-hourly-panel__price--inline";
  const PRICE_SELECTOR =
    ".hourly-mobile-route .services-hourly-panel__price-value";
  const CONFIG_SELECTOR =
    ".hourly-mobile-route [data-services-hourly-config]";
  const DATE_SELECTOR =
    ".hourly-mobile-route [data-services-hourly-date]";

  const AMOUNT_SELECTOR = "[data-hourly-mobile-price-amount]";
  const CURRENCY_SELECTOR = "[data-hourly-mobile-price-currency]";
  const PENDING_SELECTOR = "[data-hourly-mobile-price-pending]";

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  let observer = null;
  let observedNode = null;
  let isFormatting = false;
  let bodyObserver = null;

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function isHourlyMobileRouteActive() {
    return (
      isMobileViewport() &&
      document.body.getAttribute(BODY_SCREEN_ATTR) === "true"
    );
  }

  function getPriceField() {
    return document.querySelector(PRICE_FIELD_SELECTOR);
  }

  function getPriceNode() {
    return document.querySelector(PRICE_SELECTOR);
  }

  function getActiveMode() {
    const config = document.querySelector(CONFIG_SELECTOR);
    const mode = config
      ? normalizeText(config.getAttribute("data-services-hourly-mode-active"))
      : "";

    return mode || "hourly";
  }

  function getFieldValue(selector) {
    const field = selector ? document.querySelector(selector) : null;

    if (!field || typeof field.value !== "string") {
      return "";
    }

    return normalizeText(field.value);
  }

  function isRequiredDateVisible() {
    return Boolean(document.querySelector(DATE_SELECTOR));
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
  
    function normalizeListSeparatorValue(value, fallback) {
    const raw = typeof value === "string" ? value : "";
    const separator = raw.trim();
    const spacedWordSeparators = [
      "y",
      "and",
      "und",
      "et",
      "e",
      "и",
      "및"
    ];

    if (!separator) {
      return fallback;
    }

    if (separator === ",") {
      return ", ";
    }

    if (separator === "、") {
      return "、";
    }

    if (spacedWordSeparators.indexOf(separator) >= 0) {
      return " " + separator + " ";
    }

    return separator;
  }

  function joinPendingLabels(labels) {
    const safeLabels = Array.isArray(labels) ? labels.filter(Boolean) : [];
    const separator = normalizeListSeparatorValue(
      getI18nValue("airportMobileFlow.farePending.separator", ", "),
      ", "
    );
    const finalSeparator = normalizeListSeparatorValue(
      getI18nValue("airportMobileFlow.farePending.finalSeparator", " y "),
      " y "
    );

    if (safeLabels.length <= 1) {
      return safeLabels[0] || "";
    }

    if (safeLabels.length === 2) {
      return safeLabels[0] + finalSeparator + safeLabels[1];
    }

    return safeLabels.slice(0, -1).join(separator) +
      finalSeparator +
      safeLabels[safeLabels.length - 1];
  }

  function getMissingFieldLabels() {
    const labels = [];

    if (isRequiredDateVisible() && !getFieldValue(DATE_SELECTOR)) {
      labels.push(
        getI18nValue("services.cards.hourly.panel.dateLabel", "fecha")
      );
    }

    return labels;
  }

  function getPendingText() {
    const template = getI18nValue(
      "airportMobileFlow.farePending.template",
      "Completa {fields} para ver la tarifa"
    );
    const fields = joinPendingLabels(getMissingFieldLabels());

    if (!fields) {
      return getI18nValue(
        "services.cards.hourly.panel.ctaDisabled",
        "Completa la configuración"
      );
    }

    return template.replace("{fields}", fields);
  }

  function shouldForcePendingFromFields() {
    const mode = getActiveMode();

    if (mode !== "hourly" && mode !== "full_day") {
      return false;
    }

    return getMissingFieldLabels().length > 0;
  }

  function ensurePendingNode(field) {
    let node = field ? field.querySelector(PENDING_SELECTOR) : null;

    if (!field) {
      return null;
    }

    if (!node) {
      node = document.createElement("p");
      node.className = "hourly-mobile-price-pending";
      node.setAttribute("data-hourly-mobile-price-pending", "1");
      node.hidden = true;
      field.appendChild(node);
    }

    return node;
  }

  function setPendingState(isPending) {
    const field = getPriceField();
    const node = getPriceNode();
    const pending = ensurePendingNode(field);

    if (!field || !node || !pending) {
      return false;
    }

    field.setAttribute(
      "data-hourly-mobile-price-state",
      isPending ? "pending" : "ready"
    );

    node.hidden = isPending;
    pending.hidden = !isPending;
    pending.textContent = isPending ? getPendingText() : "";

    return true;
  }

  function getRawPriceText(node) {
    const rawTextNodes = node
      ? Array.from(node.childNodes).filter(function filterRawTextNode(child) {
          return (
            child &&
            child.nodeType === window.Node.TEXT_NODE &&
            normalizeText(child.textContent)
          );
        })
      : [];

    const latestRawTextNode = rawTextNodes.length
      ? rawTextNodes[rawTextNodes.length - 1]
      : null;

    const amountNode = node ? node.querySelector(AMOUNT_SELECTOR) : null;
    const currencyNode = node ? node.querySelector(CURRENCY_SELECTOR) : null;

    if (latestRawTextNode) {
      return normalizeText(latestRawTextNode.textContent);
    }

    if (amountNode) {
      return [
        normalizeText(amountNode.textContent),
        normalizeText(currencyNode ? currencyNode.textContent : "")
      ].filter(Boolean).join(" ");
    }

    return normalizeText(node ? node.textContent : "");
  }

  function getPriceParts(value) {
    const rawValue = normalizeText(value).replace(/\s+/g, " ");
    const amount = normalizeText(rawValue.replace(/\bMXN\b/gi, ""));

    if (!amount || amount === "—") {
      return {
        amount: amount || "—",
        currency: ""
      };
    }

    return {
      amount: amount,
      currency: /\bMXN\b/i.test(rawValue) ? "MXN" : ""
    };
  }

  function disconnectObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (observedNode) {
      delete observedNode.dataset.hourlyMobilePriceObserved;
      observedNode = null;
    }

    return true;
  }

  function observePriceNode(node) {
    if (!node || node.dataset.hourlyMobilePriceObserved === "1") {
      return false;
    }

    observedNode = node;
    node.dataset.hourlyMobilePriceObserved = "1";

    observer = new MutationObserver(function onPriceMutation() {
      if (isFormatting) {
        return;
      }

      disconnectObserver();

      window.requestAnimationFrame(function syncAfterMutation() {
        formatPrice();
      });
    });

    observer.observe(node, {
      childList: true,
      characterData: true,
      subtree: true
    });

    return true;
  }

  function formatPrice() {
    const node = getPriceNode();
    const parts = getPriceParts(getRawPriceText(node));
    const currentAmount = node ? node.querySelector(AMOUNT_SELECTOR) : null;
    const currentCurrency = node ? node.querySelector(CURRENCY_SELECTOR) : null;
    const amount = document.createElement("span");
    const currency = document.createElement("span");

    if (!node || !isHourlyMobileRouteActive()) {
      disconnectObserver();
      return false;
    }

    if (
      (parts.amount === "—" && !parts.currency) ||
      shouldForcePendingFromFields()
    ) {
      setPendingState(true);
      observePriceNode(node);
      return true;
    }

    setPendingState(false);

    if (
      currentAmount &&
      normalizeText(currentAmount.textContent) === parts.amount &&
      normalizeText(currentCurrency ? currentCurrency.textContent : "") === parts.currency
    ) {
      observePriceNode(node);
      return true;
    }

    isFormatting = true;
    disconnectObserver();

    node.textContent = "";

    amount.className = "services-hourly-panel__price-amount";
    amount.setAttribute("data-hourly-mobile-price-amount", "1");
    amount.textContent = parts.amount;

    node.appendChild(amount);

    if (parts.currency) {
      currency.className = "services-hourly-panel__price-currency";
      currency.setAttribute("data-hourly-mobile-price-currency", "1");
      currency.textContent = parts.currency;

      node.appendChild(currency);
    }

    isFormatting = false;

    observePriceNode(node);

    return true;
  }

  function syncActiveState() {
    if (!isHourlyMobileRouteActive()) {
      disconnectObserver();
      return false;
    }

    formatPrice();

    return true;
  }

  function observeHourlyMobileScreenState() {
    if (bodyObserver) {
      return false;
    }

    bodyObserver = new MutationObserver(function onBodyMutation() {
      window.requestAnimationFrame(syncActiveState);
    });

    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: [BODY_SCREEN_ATTR]
    });

    return true;
  }

  function init() {
    observeHourlyMobileScreenState();
    syncActiveState();

    window.addEventListener("resize", syncActiveState);
    window.addEventListener("pageshow", syncActiveState);
    window.addEventListener("pixkuy:hourly-daily-panel-ui-sync", syncActiveState);
    window.addEventListener("pixkuy:i18n-applied", syncActiveState);

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

  window.PixkuyHourlyMobilePriceFormat = {
    sync: syncActiveState
  };
})(window, document);