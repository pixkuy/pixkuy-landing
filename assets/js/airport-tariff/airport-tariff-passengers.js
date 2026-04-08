(function () {
  "use strict";

  function requireDeps(deps) {
    if (!deps || typeof deps !== "object") {
      throw new Error("PixkuyAirportTariffPassengers deps are required");
    }

    const required = [
      "normalizeText",
      "getSelectedFareKey",
      "setSelectedFareKeyState"
    ];

    required.forEach(function (key) {
      if (typeof deps[key] !== "function") {
        throw new Error("Missing passengers dependency: " + key);
      }
    });

    return deps;
  }

  function getPassengerOptionNodes(nodes) {
  if (!nodes || typeof nodes !== "object" || !nodes.passengersField) {
    return [];
  }

  const group = nodes.passengersField.querySelector(
    "[data-airport-tariff-passengers-group]"
  );

  if (!group || group.hidden || group.getAttribute("aria-hidden") === "true") {
    return [];
  }

  return Array.from(
    group.querySelectorAll("[data-airport-tariff-passenger-option]")
  );
}

  function getPassengerOptionValue(button, deps) {
    requireDeps(deps);

    if (!button || !button.dataset) {
      return "";
    }

    return deps.normalizeText(
      button.dataset.airportTariffFareKey ||
      button.dataset.airportTariffPassengerOption ||
      ""
    );
  }

  function renderPassengerSelection(nodes, state, deps) {
    requireDeps(deps);

    const optionNodes = getPassengerOptionNodes(nodes);
    const selectedFareKey = deps.getSelectedFareKey(state, deps);

    optionNodes.forEach(function (button) {
      const fareKey = getPassengerOptionValue(button, deps);
      const isSelected = fareKey && fareKey === selectedFareKey;

      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      button.classList.toggle("is-active", isSelected);
      button.dataset.airportTariffSelected = isSelected ? "true" : "false";
    });
  }

  function bindPassengerSelection(nodes, state, handlers, deps) {
    requireDeps(deps);

    const safeHandlers =
      handlers && typeof handlers === "object" ? handlers : {};

    const optionNodes = getPassengerOptionNodes(nodes);

    optionNodes.forEach(function (button) {
      if (button.dataset.airportTariffPassengerBound === "true") {
        return;
      }

      button.dataset.airportTariffPassengerBound = "true";

      button.addEventListener("click", function () {
        const fareKey = getPassengerOptionValue(button, deps);
        if (!fareKey) {
          return;
        }

        deps.setSelectedFareKeyState(
          state,
          { fareKey: fareKey },
          deps
        );

        renderPassengerSelection(nodes, state, deps);

        if (typeof safeHandlers.onChange === "function") {
          safeHandlers.onChange(fareKey);
        }
      });

      button.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        button.click();
      });
    });
  }

  window.PixkuyAirportTariffPassengers = {
    getPassengerOptionNodes: getPassengerOptionNodes,
    renderPassengerSelection: renderPassengerSelection,
    bindPassengerSelection: bindPassengerSelection
  };
})();