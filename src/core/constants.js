(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  ah.core.constants = {
    version: "0.1.0",
    namespace: "accountingHelpers",
    storageKeys: {
      settings: "accountingHelpers.settings",
      logs: "accountingHelpers.logs",
      savings: "wave.savingsDashboard",
      aliPendingPayload: "aliToWave.pendingPayload",
      aliImportedOrderIds: "aliToWave.importedOrderIds"
    },
    events: {
      settingsChanged: "accounting-helpers:settings-changed",
      pendingPayloadChanged: "accounting-helpers:pending-payload-changed"
    },
    waveTransactionsUrl: "https://next.waveapps.com/transactions"
  };
})();
