(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  async function fillFromAliPayload(payload) {
    const modal = ah.sites.wave.transactionModal.findOpenModal();
    if (!modal) {
      return {
        ok: false,
        complete: false,
        orderId: payload?.orderId || "",
        filled: [],
        skipped: [],
        missing: [],
        attempted: [],
        verified: [],
        modalStillOpen: false,
        dropdownsOpenAfterFill: false,
        pendingPayloadCleared: false,
        duplicateGuardMarkedImported: false,
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

    async function ensureVendorField(value) {
      if (!value) return { attempted: false, ok: true, reason: "no vendor configured" };
      if (ah.sites.wave.transactionModal.findField(["vendor", "payee", "merchant"])) {
        return { attempted: false, ok: true, reason: "vendor field already visible" };
      }
      if (!ah.sites.wave.transactionModal.clickButton(["Add vendor"])) {
        return { attempted: true, ok: false, reason: "Add vendor button not found" };
      }
      try {
        await ah.core.dom.waitFor(() => ah.sites.wave.transactionModal.findField(["vendor", "payee", "merchant"]), { timeout: 3000, interval: 100 });
        return { attempted: true, ok: true, reason: "" };
      } catch (_error) {
        return { attempted: true, ok: false, reason: "vendor field did not appear" };
      }
    }

    async function fillField(name, labels, value, options) {
      if (value === null || value === undefined || value === "") {
        return { name, ok: true, skipped: true, reason: "no value configured" };
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
    const vendorFieldResult = await ensureVendorField(defaults.vendor);
    results.push(await fillField("date", ["date"], payload.orderDate));
    results.push(await fillField("description", ["description", "notes"], description));
    results.push(await fillField("amount", ["amount", "total"], payload.amount?.value));
    results.push(await fillField("type", ["type"], defaults.type, { dropdown: true }));
    results.push(await fillField("account", ["account", "payment account"], defaults.account, { dropdown: true }));
    results.push(await fillField("category", ["category"], defaults.category, { dropdown: true }));
    results.push(await fillField("vendor", ["vendor", "payee", "merchant"], defaults.vendor, { dropdown: true }));

    const filled = results.filter((result) => result.ok && !result.skipped).map((result) => result.name);
    const skipped = results.filter((result) => result.skipped).map((result) => result.name);
    const missing = results.filter((result) => !result.ok).map((result) => `${result.name} (${result.reason})`);
    if (vendorFieldResult.attempted && !vendorFieldResult.ok && !missing.some((item) => item.startsWith("vendor "))) {
      missing.push(`vendor (${vendorFieldResult.reason})`);
    }
    const attempted = results.filter((result) => !result.skipped).map((result) => result.name);
    const verified = results.filter((result) => result.ok && !result.skipped).map((result) => result.name);
    const modalStillOpen = !!ah.sites.wave.transactionModal.findOpenModal();
    const dropdownsOpenAfterFill = !!ah.sites.wave.dropdowns.diagnostics?.().anyOpen;
    return {
      ok: filled.length > 0,
      complete: filled.length > 0 && missing.length === 0,
      orderId: payload.orderId || "",
      filled,
      skipped,
      missing,
      attempted,
      verified,
      modalStillOpen,
      dropdownsOpenAfterFill,
      pendingPayloadCleared: false,
      duplicateGuardMarkedImported: false,
      saved: false,
      message: missing.length ?
        `Partially filled Wave transaction. Filled: ${filled.join(", ") || "none"}. Could not fill: ${missing.join(", ")}.` :
        `Filled Wave transaction from AliExpress order ${payload.orderId}.`
    };
  }

  ah.sites.wave.fillTransaction = { fillFromAliPayload };
})();
