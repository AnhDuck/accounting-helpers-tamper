(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  ah.core.constants = {
    version: "0.1.15",
    namespace: "accountingHelpers",
    storageKeys: {
      settings: "accountingHelpers.settings",
      logs: "accountingHelpers.logs",
      savings: "wave.savingsDashboard",
      aliPendingPayload: "aliToWave.pendingPayload",
      aliImportedOrderIds: "aliToWave.importedOrderIds",
      waveHeartbeat: "wave.heartbeat",
      wavePresenceRequest: "wave.presenceRequest"
    },
    events: {
      settingsChanged: "accounting-helpers:settings-changed",
      pendingPayloadChanged: "accounting-helpers:pending-payload-changed"
    },
    waveTransactionsUrl: "https://next.waveapps.com/4fa56888-48ef-445b-b9bc-5fef30b02059/transactions"
  };
})();
