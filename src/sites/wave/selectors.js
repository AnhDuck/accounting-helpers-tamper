(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  ah.sites.wave.selectors = {
    modal: "[role='dialog'], [data-testid*='modal'], .modal, [class*='Modal']",
    buttons: "button, [role='button']",
    fields: "input, textarea, select, [contenteditable='true'], [role='combobox']",
    transactionRows: "[data-testid*='transaction'], tr, [role='row']"
  };
})();
