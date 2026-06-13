(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  let storageListenersInstalled = false;

  function installDebugObject() {
    const debug = window.AccountingHelpersDebug = window.AccountingHelpersDebug || {};
    Object.assign(debug, {
      getSettings() {
        return ah.core.settings.all();
      },
      clearSettings() {
        ah.core.settings.reset();
      },
      getPendingAliToWavePayload() {
        return ah.core.storage.get(ah.core.constants.storageKeys.aliPendingPayload, null);
      },
      clearPendingAliToWavePayload() {
        ah.core.storage.remove(ah.core.constants.storageKeys.aliPendingPayload);
        window.dispatchEvent(new CustomEvent(ah.core.constants.events.pendingPayloadChanged));
      },
      getImportedAliExpressOrders() {
        return ah.features.aliToWave.duplicateGuard.all();
      },
      clearImportedAliExpressOrders() {
        ah.features.aliToWave.duplicateGuard.clear();
      },
      getLogs() {
        return ah.core.logger.getLogs();
      },
      runDiagnostics() {
        return ah.features.diagnostics.runDiagnostics();
      },
      runStorageDiagnostics() {
        return ah.features.diagnostics.runStorageDiagnostics();
      },
      runWaveDiagnostics() {
        return ah.features.diagnostics.runWaveDiagnostics();
      },
      runAliToWaveDiagnostics() {
        return ah.features.diagnostics.runAliToWaveDiagnostics();
      },
      exportDebugReport() {
        return ah.features.diagnostics.exportDebugReport();
      },
      copyDebugReport() {
        return ah.features.diagnostics.copyDebugReport();
      },
      getLastDiagnostics() {
        return ah.features.diagnostics.getLastDiagnostics();
      },
      getLastFillResult() {
        return ah.features.aliToWave.getLastFillResult?.() || ah.features.aliToWave.lastFillResult || null;
      }
    });
  }

  function ensureAll() {
    ah.ui.styles.ensureStyles();
    ah.ui.toast.ensureToastLayer();
    ah.ui.settingsModal.registerMenuCommand();
    installDebugObject();
    ah.features.diagnostics.ensure();

    if (ah.sites.wave.detect.isWave()) {
      ah.sites.wave.heartbeat?.ensure?.();
      ah.features.waveSavingsDashboard.ensure();
      ah.features.waveTaxButtons.ensure();
      ah.features.waveAccountSwitcher.ensure();
      ah.features.waveReviewedSave.ensure();
      ah.features.aliToWave.ensureWaveImportUI();
    }

    if (ah.sites.aliexpress.detect.isAliExpress()) {
      ah.features.aliexpressCadCopy.ensure();
      ah.features.aliexpressCartPerUnit.ensure();
      ah.features.aliToWave.ensureAliExpressSendButton();
    }
  }

  function installStorageListeners() {
    if (storageListenersInstalled || typeof ah.core.storage.onChange !== "function") return;
    storageListenersInstalled = true;
    ah.core.storage.onChange(ah.core.constants.storageKeys.aliPendingPayload, (payload) => {
      window.dispatchEvent(new CustomEvent(ah.core.constants.events.pendingPayloadChanged, { detail: payload }));
    });
    ah.core.storage.onChange(ah.core.constants.storageKeys.settings, (settings) => {
      window.dispatchEvent(new CustomEvent(ah.core.constants.events.settingsChanged, { detail: settings }));
    });
  }

  const scheduleEnsureAll = ah.core.events.rafThrottle(ensureAll);

  function start() {
    installStorageListeners();
    ensureAll();
    const observer = new MutationObserver(scheduleEnsureAll);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener(ah.core.constants.events.settingsChanged, scheduleEnsureAll);
    window.addEventListener(ah.core.constants.events.pendingPayloadChanged, scheduleEnsureAll);
    setInterval(() => {
      if (ah.sites.aliexpress.detect.isOrderPage()) ah.features.aliexpressCadCopy.scheduleScan();
    }, 10 * 60 * 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
