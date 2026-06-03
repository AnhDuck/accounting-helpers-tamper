(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  function findCurrentRow() {
    const rows = ah.core.dom.visible(ah.core.dom.qsa(ah.sites.wave.selectors.transactionRows));
    return rows.find((row) => row.matches("[aria-selected='true'], .selected, [data-selected='true']")) || rows[0] || null;
  }

  function clickCopyOnCurrentRow() {
    const row = findCurrentRow();
    if (!row) return false;
    const copyButton = ah.core.dom.findByText(row, ah.sites.wave.selectors.buttons, "copy");
    if (copyButton) {
      copyButton.click();
      return true;
    }
    const actionButton = ah.core.dom.findByText(row, ah.sites.wave.selectors.buttons, (text) =>
      text.includes("more") || text.includes("actions") || text === "..."
    );
    if (!actionButton) return false;
    actionButton.click();
    setTimeout(() => {
      ah.core.dom.findByText(document, ah.sites.wave.selectors.buttons, "copy")?.click();
    }, 200);
    return true;
  }

  ah.sites.wave.transactionList = { findCurrentRow, clickCopyOnCurrentRow };
})();
