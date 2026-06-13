(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  function findOpenModal() {
    const selector = ah.sites.wave.selectors.modal;
    const modals = ah.core.dom.visible(ah.core.dom.qsa(selector));
    return modals.find((modal) => /edit\s+transaction/i.test(ah.core.dom.text(modal))) || modals.at(-1) || null;
  }

  function findField(labels) {
    const root = findOpenModal() || document;
    const field = ah.core.dom.findFieldByLabel(root, labels);
    if (field) return field;

    const labelList = (Array.isArray(labels) ? labels : [labels]).map((label) => String(label).toLowerCase());
    const fields = ah.core.dom.visible(ah.core.dom.qsa(ah.sites.wave.selectors.fields, root));
    if (labelList.some((label) => label === "date")) {
      return fields.find((item) => item.tagName === "INPUT" && /^\d{4}-\d{2}-\d{2}$/.test(item.value || ""));
    }
    if (labelList.some((label) => ["description", "notes"].includes(label))) {
      return fields.find((item) => /description/i.test(item.getAttribute("placeholder") || ""));
    }
    if (labelList.some((label) => ["amount", "total"].includes(label))) {
      return fields.find((item) => /amount/i.test(item.getAttribute("aria-label") || ""));
    }
    if (labelList.some((label) => label === "type")) {
      return fields.find((item) => item.tagName === "SELECT" && /direction/i.test(item.getAttribute("name") || ""));
    }
    return null;
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
      .map((label) => ah.core.dom.findByText(root, ah.sites.wave.selectors.buttons, label))
      .find(Boolean);
    if (!button) return false;
    button.click();
    return true;
  }

  ah.sites.wave.transactionModal = { findOpenModal, findField, readField, setField, clickButton };
})();
