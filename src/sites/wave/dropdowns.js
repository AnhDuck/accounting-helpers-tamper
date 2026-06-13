(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  const dom = () => ah.core.dom;

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function selectWrapper(field) {
    return field?.closest?.(".wv-select") || field;
  }

  function selectedText(field) {
    const wrapper = selectWrapper(field);
    const label = wrapper?.querySelector?.(".wv-select__label");
    return dom().text(label || field);
  }

  function isSelected(field, optionText) {
    const text = normalize(selectedText(field));
    const value = normalize(field.value);
    const needle = normalize(optionText);
    return !!needle && (text.includes(needle) || value.includes(needle));
  }

  function visibleOptions(field) {
    const selector = "[role='option'], [role='menuitemradio'], .wv-select__menu__option";
    const wrapper = selectWrapper(field);
    const scoped = wrapper ? dom().visible(dom().qsa(selector, wrapper)) : [];
    return scoped.length ? scoped : dom().visible(dom().qsa(selector));
  }

  function findOption(field, optionText) {
    const needle = normalize(optionText);
    const options = visibleOptions(field);
    return options.find((item) => normalize(dom().text(item)) === needle) ||
      options.find((item) => normalize(dom().text(item)).includes(needle));
  }

  async function closeMenu(field) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (visibleOptions(field).length) {
      field.click();
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    field.blur?.();
  }

  async function chooseOption(field, optionText) {
    if (!field || !optionText) return false;
    field.focus();
    field.click();

    if (field.tagName === "SELECT") {
      const option = Array.from(field.options).find((item) =>
        item.textContent.trim().toLowerCase().includes(optionText.toLowerCase())
      );
      if (!option) return false;
      field.value = option.value;
      field.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    let option = findOption(field, optionText);
    if (!option) {
      field.click();
      await new Promise((resolve) => setTimeout(resolve, 180));
      option = findOption(field, optionText);
    }
    if (!option) {
      const active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA"].includes(active.tagName)) {
        ah.core.react.setFieldValue(active, optionText);
      } else {
        ah.core.react.setFieldValue(field, optionText);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      option = findOption(field, optionText);
    }
    if (option) {
      option.click();
      await new Promise((resolve) => setTimeout(resolve, 220));
      await closeMenu(field);
      return isSelected(field, optionText);
    }
    await closeMenu(field);
    return isSelected(field, optionText);
  }

  function getVisibleSelection(labels) {
    const field = ah.sites.wave.transactionModal.findField(labels);
    if (!field) return "";
    return field.value || field.getAttribute("aria-label") || dom().text(field);
  }

  ah.sites.wave.dropdowns = { chooseOption, getVisibleSelection };
})();
