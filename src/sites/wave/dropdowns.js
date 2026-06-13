(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  const dom = () => ah.core.dom;

  function isSelected(field, optionText) {
    const text = dom().text(field).toLowerCase();
    const value = String(field.value || "").toLowerCase();
    const needle = String(optionText || "").toLowerCase();
    return !!needle && (text.includes(needle) || value.includes(needle));
  }

  function visibleOptions() {
    return dom().visible(dom().qsa("[role='option'], li, button, [data-testid*='option']"));
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

    field.click();
    await new Promise((resolve) => setTimeout(resolve, 180));
    let option = visibleOptions().find((item) => dom().text(item).toLowerCase().includes(optionText.toLowerCase()));
    if (!option) {
      const active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA"].includes(active.tagName)) {
        ah.core.react.setFieldValue(active, optionText);
      } else {
        ah.core.react.setFieldValue(field, optionText);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      option = visibleOptions().find((item) => dom().text(item).toLowerCase().includes(optionText.toLowerCase()));
    }
    if (option) {
      option.click();
      await new Promise((resolve) => setTimeout(resolve, 220));
      return isSelected(field, optionText);
    }
    return isSelected(field, optionText);
  }

  function getVisibleSelection(labels) {
    const field = ah.sites.wave.transactionModal.findField(labels);
    if (!field) return "";
    return field.value || field.getAttribute("aria-label") || dom().text(field);
  }

  ah.sites.wave.dropdowns = { chooseOption, getVisibleSelection };
})();
