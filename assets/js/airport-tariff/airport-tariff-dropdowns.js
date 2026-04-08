(function () {
  "use strict";

  function createDropdownPanel(role) {
    const panel = document.createElement("div");
    panel.className = "place-autocomplete__panel";
    panel.hidden = true;
    panel.dataset.airportTariffDropdown = role;
    panel.id = "airport-tariff-" + role + "-listbox";
    panel.setAttribute("role", "listbox");
    panel.setAttribute("tabindex", "-1");
    return panel;
  }

  function createStatusNode(kind, text) {
    const status = document.createElement("div");
    status.className = "place-autocomplete__status";

    if (kind) {
      status.classList.add("is-" + kind);
    }

    status.textContent = text;
    return status;
  }

  function createOptionNode(role, option, index, isActive) {
    const item = document.createElement("div");
    item.className = "place-autocomplete__item";
    item.setAttribute("role", "presentation");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "place-autocomplete__item-button";
    button.setAttribute("role", "option");
    button.id = "airport-tariff-" + role + "-option-" + index;
    button.dataset.airportTariffOptionRole = role;
    button.dataset.airportTariffOptionIndex = String(index);
    button.dataset.airportTariffOptionType = option.type;
    button.dataset.airportTariffOptionValue = option.id;
    button.dataset.airportTariffOptionLabel = option.label;
    button.setAttribute("aria-selected", isActive ? "true" : "false");

    if (isActive) {
      button.classList.add("is-active");
    }

    const title = document.createElement("span");
    title.className = "place-autocomplete__item-title";
    title.textContent = option.label;

    button.appendChild(title);
    item.appendChild(button);

    return item;
  }

  function updateActiveOption(config) {
    const panel = config.panel;
    const control = config.control;
    const activeIndex = config.activeIndex;

    const buttons = Array.from(
      panel.querySelectorAll(".place-autocomplete__item-button")
    );

    buttons.forEach(function (button, index) {
      const isActive = index === activeIndex;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");

      if (isActive) {
        control.setAttribute("aria-activedescendant", button.id);
      }
    });
  }

  function renderDropdown(config) {
    const panel = config.panel;
    const control = config.control;
    const role = config.role;
    const options = Array.isArray(config.options) ? config.options : [];
    const selectedIndex =
      typeof config.selectedIndex === "number" ? config.selectedIndex : -1;
    const getEmptyText =
      typeof config.getEmptyText === "function" ? config.getEmptyText : null;

    panel.innerHTML = "";
    panel.setAttribute("aria-label", control.textContent.trim() || role);

    if (!options.length) {
      panel.appendChild(
        createStatusNode("empty", getEmptyText ? getEmptyText() : "")
      );
      control.removeAttribute("aria-activedescendant");
      return { activeIndex: -1 };
    }

    const nextActiveIndex = selectedIndex >= 0 ? selectedIndex : 0;

    options.forEach(function (option, index) {
      const node = createOptionNode(
        role,
        option,
        index,
        index === nextActiveIndex
      );
      panel.appendChild(node);
    });

    updateActiveOption({
      panel: panel,
      control: control,
      activeIndex: nextActiveIndex
    });

    return { activeIndex: nextActiveIndex };
  }

  function openDropdown(config) {
    const panel = config.panel;
    const control = config.control;

    panel.hidden = false;
    panel.classList.add("is-visible");
    control.setAttribute("aria-expanded", "true");
    control.setAttribute("aria-controls", panel.id);
  }

  function closeDropdown(config) {
    const panel = config.panel;
    const control = config.control;

    panel.hidden = true;
    panel.classList.remove("is-visible");
    panel.innerHTML = "";
    control.setAttribute("aria-expanded", "false");
    control.removeAttribute("aria-controls");
    control.removeAttribute("aria-activedescendant");
  }

  function moveActiveIndex(config) {
    const panel = config.panel;
    const control = config.control;
    const currentIndex =
      typeof config.currentIndex === "number" ? config.currentIndex : -1;
    const direction = typeof config.direction === "number" ? config.direction : 0;

    const options = Array.from(
      panel.querySelectorAll(".place-autocomplete__item-button")
    );

    if (!options.length) {
      return { activeIndex: -1 };
    }

    const lastIndex = options.length - 1;
    const safeCurrentIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = Math.max(
      0,
      Math.min(lastIndex, safeCurrentIndex + direction)
    );

    updateActiveOption({
      panel: panel,
      control: control,
      activeIndex: nextIndex
    });

    const activeButton = options[nextIndex];
    if (activeButton && typeof activeButton.scrollIntoView === "function") {
      activeButton.scrollIntoView({ block: "nearest" });
    }

    return { activeIndex: nextIndex };
  }

  function toggleDropdown(config) {
    if (config.isOpen) {
      closeDropdown({
        panel: config.panel,
        control: config.control
      });
      return { isOpen: false };
    }

    openDropdown({
      panel: config.panel,
      control: config.control
    });

    return { isOpen: true };
  }

  function commitActiveOption(config) {
    const panel = config.panel;
    const activeIndex =
      typeof config.activeIndex === "number" ? config.activeIndex : -1;

    const activeButton = panel.querySelector(
      '.place-autocomplete__item-button[data-airport-tariff-option-index="' +
        String(activeIndex) +
        '"]'
    );

    if (!activeButton) {
      return null;
    }

    return {
      role: activeButton.dataset.airportTariffOptionRole || "",
      optionType: activeButton.dataset.airportTariffOptionType || "",
      optionValue: activeButton.dataset.airportTariffOptionValue || "",
      optionLabel: activeButton.dataset.airportTariffOptionLabel || ""
    };
  }

  function isEventInsideDropdownArea(config) {
    const target = config.target;
    const originField = config.originField;
    const destinationField = config.destinationField;
    const passengersField = config.passengersField;

    return (
      !!originField &&
      !!destinationField &&
      !!passengersField &&
      (originField.contains(target) ||
        destinationField.contains(target) ||
        passengersField.contains(target))
    );
  }

  function buildDropdownDom(config) {
    const ensureFieldAnchoring = config.ensureFieldAnchoring;
    const originField = config.originField;
    const destinationField = config.destinationField;
    const passengersField = config.passengersField;

    if (typeof ensureFieldAnchoring === "function") {
      ensureFieldAnchoring(originField);
      ensureFieldAnchoring(destinationField);
      ensureFieldAnchoring(passengersField);
    }

    const originDropdown = createDropdownPanel("origin");
    const destinationDropdown = createDropdownPanel("destination");
    const passengersDropdown = createDropdownPanel("passengers");

    originField.appendChild(originDropdown);
    destinationField.appendChild(destinationDropdown);
    passengersField.appendChild(passengersDropdown);

    return {
      originDropdown: originDropdown,
      destinationDropdown: destinationDropdown,
      passengersDropdown: passengersDropdown
    };
  }

  window.PixkuyAirportTariffDropdowns = {
    createDropdownPanel: createDropdownPanel,
    createStatusNode: createStatusNode,
    createOptionNode: createOptionNode,
    updateActiveOption: updateActiveOption,
    renderDropdown: renderDropdown,
    openDropdown: openDropdown,
    closeDropdown: closeDropdown,
    moveActiveIndex: moveActiveIndex,
    toggleDropdown: toggleDropdown,
    commitActiveOption: commitActiveOption,
    isEventInsideDropdownArea: isEventInsideDropdownArea,
    buildDropdownDom: buildDropdownDom
  };
})();