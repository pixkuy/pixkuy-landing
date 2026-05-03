/* assets/js/services/hourly-mobile-vehicle-label.js
   Hourly / Daily mobile vehicle footer label.
   Responsabilidad:
   - ajustar solo el texto visible del vehículo en el footer móvil Hourly
   - no tocar hourly-daily-panel.js
   - no tocar desktop
   - no tocar payload
*/

(function initHourlyMobileVehicleLabel(window, document) {
  "use strict";

  if (!window || !document) {
    return;
  }

  const MOBILE_QUERY = "(max-width: 720px)";
  const BODY_SCREEN_ATTR = "data-hourly-mobile-screen";

  const VEHICLE_NAME_SELECTOR =
    '.hourly-mobile-route [data-hourly-mobile-vehicle-in-footer="true"] .services-hourly-panel__vehicle-name';

  const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
  }

  function isHourlyMobileRouteActive() {
    return (
      isMobileViewport() &&
      document.body.getAttribute(BODY_SCREEN_ATTR) === "true"
    );
  }

  function syncVehicleLabel() {
    const name = document.querySelector(VEHICLE_NAME_SELECTOR);

    if (!isHourlyMobileRouteActive() || !name) {
      return false;
    }

    name.textContent = "Van Premium - ByD M9";

    return true;
  }

  function init() {
    syncVehicleLabel();

    window.addEventListener("resize", syncVehicleLabel);
    window.addEventListener("pageshow", syncVehicleLabel);
    window.addEventListener("pixkuy:hourly-daily-panel-ui-sync", syncVehicleLabel);
    window.addEventListener("pixkuy:i18n-applied", syncVehicleLabel);

    if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", syncVehicleLabel);
    } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(syncVehicleLabel);
    }

    return true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.PixkuyHourlyMobileVehicleLabel = {
    sync: syncVehicleLabel
  };
})(window, document);