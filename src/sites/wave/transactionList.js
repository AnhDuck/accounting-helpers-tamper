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

  function findAddTransactionButton() {
    return ah.core.dom.visible(ah.core.dom.qsa(ah.sites.wave.selectors.buttons))
      .find((button) => ah.core.dom.text(button).toLowerCase() === "add transaction") || null;
  }

  function findAddWithdrawalMenuItem() {
    return ah.core.dom.visible(ah.core.dom.qsa(ah.sites.wave.selectors.buttons))
      .find((button) =>
        ah.core.dom.text(button).toLowerCase() === "add withdrawal" &&
        button.getAttribute("role") === "menuitem"
      ) || null;
  }

  async function openAddWithdrawalModal() {
    if (ah.sites.wave.transactionModal.findOpenModal()) {
      return { ok: false, message: "A Wave transaction modal is already open. Use Fill this transaction or close it before creating a new withdrawal." };
    }

    const addTransaction = findAddTransactionButton();
    if (!addTransaction) {
      return { ok: false, message: "Could not find Wave's Add transaction button." };
    }

    addTransaction.click();

    let addWithdrawal;
    try {
      addWithdrawal = await ah.core.dom.waitFor(findAddWithdrawalMenuItem, { timeout: 2500, interval: 100 });
    } catch (error) {
      return { ok: false, message: "Could not find Wave's Add withdrawal menu item." };
    }

    addWithdrawal.click();

    try {
      await ah.core.dom.waitFor(() => ah.sites.wave.transactionModal.hasReadyTransactionFields(), { timeout: 7000, interval: 100 });
    } catch (error) {
      return { ok: false, message: "Wave did not finish loading the Add transaction fields." };
    }

    return {
      ok: true,
      message: "Opened a new Wave withdrawal.",
      clicksSavedSteps: ["Add transaction", "Add withdrawal"]
    };
  }

  ah.sites.wave.transactionList = {
    findCurrentRow,
    clickCopyOnCurrentRow,
    findAddTransactionButton,
    findAddWithdrawalMenuItem,
    openAddWithdrawalModal
  };
})();
