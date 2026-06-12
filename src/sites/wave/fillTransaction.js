(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  async function fillFromAliPayload(payload) {
    const modal = ah.sites.wave.transactionModal.findOpenModal();
    if (!modal) {
      return {
        ok: false,
        filled: [],
        missing: [],
        message: "Open a Wave edit transaction modal first, then click Fill this transaction."
      };
    }

    const settings = ah.core.settings.all();
    const description = `${settings.wave.descriptionPrefix || ""}${payload.orderId || ""}`.trim();
    const defaults = {
      vendor: payload.wave?.vendor || settings.wave.defaultAliExpressVendor,
      account: payload.wave?.account || settings.wave.defaultAliExpressAccount,
      category: payload.wave?.category || settings.wave.defaultAliExpressCategory,
      type: payload.wave?.type || settings.wave.defaultAliExpressType
    };

    async function fillField(name, labels, value, options) {
      if (value === null || value === undefined || value === "") {
        return { name, ok: false, reason: "no value configured" };
      }
      const field = ah.sites.wave.transactionModal.findField(labels);
      if (!field) {
        return { name, ok: false, reason: "field not found" };
      }
      const ok = options?.dropdown ?
        await ah.sites.wave.dropdowns.chooseOption(field, String(value)) :
        ah.core.react.setFieldValue(field, String(value));
      return { name, ok, reason: ok ? "" : "field could not be filled" };
    }

    const results = [];
    results.push(await fillField("date", ["date"], payload.orderDate));
    results.push(await fillField("description", ["description", "notes"], description));
    results.push(await fillField("amount", ["amount", "total"], payload.amount?.value));
    results.push(await fillField("type", ["type"], defaults.type, { dropdown: true }));
    results.push(await fillField("account", ["account", "payment account"], defaults.account, { dropdown: true }));
    results.push(await fillField("category", ["category"], defaults.category, { dropdown: true }));
    results.push(await fillField("vendor", ["vendor", "payee", "merchant"], defaults.vendor, { dropdown: true }));

    const filled = results.filter((result) => result.ok).map((result) => result.name);
    const missing = results.filter((result) => !result.ok).map((result) => `${result.name} (${result.reason})`);
    if (settings.aliToWave.autoSaveAfterFill && missing.length === 0) {
      ah.sites.wave.transactionModal.clickButton(["Save", "Update"]);
    }

    return {
      ok: filled.length > 0,
      filled,
      missing,
      message: missing.length ?
        `Partially filled Wave transaction. Filled: ${filled.join(", ") || "none"}. Could not fill: ${missing.join(", ")}.` :
        `Filled Wave transaction from AliExpress order ${payload.orderId}.`
    };
  }

  ah.sites.wave.fillTransaction = { fillFromAliPayload };
})();
