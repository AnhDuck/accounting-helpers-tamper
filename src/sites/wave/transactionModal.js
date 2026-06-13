(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  function findOpenModal() {
    const selector = ah.sites.wave.selectors.modal;
    const modals = ah.core.dom.visible(ah.core.dom.qsa(selector))
      .filter((modal) => !modal.closest("#ah-settings-modal") && !modal.classList.contains("ah-modal"));
    return modals.find((modal) => /(add|edit)\s+transaction/i.test(ah.core.dom.text(modal))) || null;
  }

  function findWaveSelectByLabel(root, labels) {
    const labelList = (Array.isArray(labels) ? labels : [labels]).map((label) => String(label).toLowerCase());
    const fields = ah.core.dom.visible(ah.core.dom.qsa(".wv-form-field", root));
    for (const field of fields) {
      const label = ah.core.dom.text(field.querySelector(".wv-form-field__label, label")).toLowerCase();
      if (!labelList.some((item) => label.includes(item))) continue;
      const controls = ah.core.dom.visible(ah.core.dom.qsa(".wv-select__input, .wv-select, [role='combobox']", field));
      const control = controls.find((item) => item.classList.contains("wv-select__input")) || controls[0];
      if (control) return control;
    }
    return null;
  }

  function findField(labels) {
    const root = findOpenModal() || document;
    const labelList = (Array.isArray(labels) ? labels : [labels]).map((label) => String(label).toLowerCase());
    const fields = ah.core.dom.visible(ah.core.dom.qsa(ah.sites.wave.selectors.fields, root));
    if (labelList.some((label) => label === "date")) {
      const field = fields.find((item) => item.tagName === "INPUT" && /^\d{4}-\d{2}-\d{2}$/.test(item.value || ""));
      if (field) return field;
    }
    if (labelList.some((label) => ["description", "notes"].includes(label))) {
      const field = fields.find((item) => /description/i.test(item.getAttribute("placeholder") || ""));
      if (field) return field;
    }
    if (labelList.some((label) => ["amount", "total"].includes(label))) {
      const field = fields.find((item) => /amount/i.test(item.getAttribute("aria-label") || ""));
      if (field) return field;
    }
    if (labelList.some((label) => label === "type")) {
      const field = fields.find((item) => item.tagName === "SELECT" && /direction/i.test(item.getAttribute("name") || ""));
      if (field) return field;
    }
    if (labelList.some((label) => ["account", "category", "vendor", "payee", "merchant"].includes(label))) {
      const field = findWaveSelectByLabel(root, labels);
      if (field) return field;
      return null;
    }
    return ah.core.dom.findFieldByLabel(root, labels);
  }

  function hasReadyTransactionFields() {
    const modal = findOpenModal();
    return !!(
      modal &&
      findField(["date"]) &&
      findField(["description", "notes"]) &&
      findField(["amount", "total"]) &&
      findField(["type"])
    );
  }

  function readField(labels) {
    const field = findField(labels);
    if (!field) return "";
    return field.value || field.getAttribute("aria-label") || ah.core.dom.text(field);
  }

  async function setField(labels, value, options) {
    if (value === null || value === undefined || value === "") return false;
    const field = findField(labels);
    if (!field) return false;

    if (options?.dropdown) {
      return ah.sites.wave.dropdowns.chooseOption(field, String(value));
    }
    return ah.core.react.setFieldValue(field, String(value));
  }

  function clickButton(labels) {
    const root = findOpenModal() || document;
    const labelList = Array.isArray(labels) ? labels : [labels];
    const button = labelList
      .map((label) => ah.core.dom.findByText(root, `${ah.sites.wave.selectors.buttons}, a`, label))
      .find(Boolean);
    if (!button) return false;
    button.click();
    return true;
  }

  ah.sites.wave.transactionModal = { findOpenModal, findField, readField, setField, clickButton, hasReadyTransactionFields };
})();
