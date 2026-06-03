(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  async function fillFromAliPayload(payload) {
    const modal = ah.sites.wave.transactionModal.findOpenModal();
    if (!modal) {
      return { ok: false, message: "Open a Wave transaction first." };
    }

    const settings = ah.core.settings.all();
    const description = `${settings.wave.descriptionPrefix || ""}${payload.orderId || ""}`.trim();
    const defaults = {
      vendor: payload.wave?.vendor || settings.wave.defaultAliExpressVendor,
      account: payload.wave?.account || settings.wave.defaultAliExpressAccount,
      category: payload.wave?.category || settings.wave.defaultAliExpressCategory,
      type: payload.wave?.type || settings.wave.defaultAliExpressType
    };

    const results = [];
    results.push(["date", await ah.sites.wave.transactionModal.setField(["date"], payload.orderDate)]);
    results.push(["description", await ah.sites.wave.transactionModal.setField(["description", "notes"], description)]);
    results.push(["amount", await ah.sites.wave.transactionModal.setField(["amount", "total"], payload.amount?.value)]);
    results.push(["type", await ah.sites.wave.transactionModal.setField(["type"], defaults.type, { dropdown: true })]);
    results.push(["account", await ah.sites.wave.transactionModal.setField(["account", "payment account"], defaults.account, { dropdown: true })]);
    results.push(["category", await ah.sites.wave.transactionModal.setField(["category"], defaults.category, { dropdown: true })]);
    results.push(["vendor", await ah.sites.wave.transactionModal.setField(["vendor", "payee", "merchant"], defaults.vendor, { dropdown: true })]);

    const missing = results.filter(([, ok]) => !ok).map(([name]) => name);
    if (settings.aliToWave.autoSaveAfterFill && missing.length === 0) {
      ah.sites.wave.transactionModal.clickButton(["Save", "Update"]);
    }

    return {
      ok: missing.length < results.length,
      message: missing.length ? `Filled what could be found. Missing: ${missing.join(", ")}` : "AliExpress payload filled."
    };
  }

  ah.sites.wave.fillTransaction = { fillFromAliPayload };
})();
