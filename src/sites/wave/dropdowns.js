(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  const dom = () => ah.core.dom;

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

    ah.core.react.setFieldValue(field, optionText);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const option = dom().findByText(document, "[role='option'], li, button, [data-testid*='option']", optionText);
    if (option) {
      option.click();
      return true;
    }
    return true;
  }

  function getVisibleSelection(labels) {
    const field = ah.sites.wave.transactionModal.findField(labels);
    if (!field) return "";
    return field.value || field.getAttribute("aria-label") || dom().text(field);
  }

  ah.sites.wave.dropdowns = { chooseOption, getVisibleSelection };
})();
