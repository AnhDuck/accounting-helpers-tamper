(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.aliToWave = ah.features.aliToWave || {};

  const key = ah.core.constants.storageKeys.aliImportedOrderIds;

  function all() {
    return ah.core.storage.get(key, {}) || {};
  }

  function isImported(orderId) {
    return !!all()[orderId];
  }

  function markImported(payload) {
    if (!payload?.orderId) return false;
    const next = all();
    next[payload.orderId] = {
      importedAt: Date.now(),
      amount: payload.amount?.value || "",
      sourceUrl: payload.sourceUrl || ""
    };
    return ah.core.storage.set(key, next);
  }

  function clear() {
    ah.core.storage.remove(key);
  }

  ah.features.aliToWave.duplicateGuard = { all, isImported, markImported, clear };
})();
