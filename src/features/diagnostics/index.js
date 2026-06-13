(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.diagnostics = ah.features.diagnostics || {};
  ah.features.aliToWave = ah.features.aliToWave || {};

  const panelId = "ah-diagnostics-panel";
  const modalId = "ah-diagnostics-modal";
  let lastDiagnostics = null;

  function gmFunction(name) {
    const apis = {
      GM_getValue: typeof GM_getValue === "function" ? GM_getValue : globalThis.GM_getValue,
      GM_setValue: typeof GM_setValue === "function" ? GM_setValue : globalThis.GM_setValue,
      GM_deleteValue: typeof GM_deleteValue === "function" ? GM_deleteValue : globalThis.GM_deleteValue,
      GM_listValues: typeof GM_listValues === "function" ? GM_listValues : globalThis.GM_listValues,
      GM_addValueChangeListener: typeof GM_addValueChangeListener === "function" ?
        GM_addValueChangeListener :
        globalThis.GM_addValueChangeListener
    };
    return typeof apis[name] === "function" ? apis[name] : null;
  }

  function gmAvailable() {
    return {
      get: !!gmFunction("GM_getValue"),
      set: !!gmFunction("GM_setValue"),
      delete: !!gmFunction("GM_deleteValue"),
      list: !!gmFunction("GM_listValues"),
      changeListener: !!gmFunction("GM_addValueChangeListener")
    };
  }

  function scriptMetadata() {
    const info = typeof GM_info === "object" && GM_info ? GM_info : {};
    const script = info.script || {};
    const devConfig = (
      typeof AccountingHelpersDevConfig !== "undefined" &&
      AccountingHelpersDevConfig &&
      typeof AccountingHelpersDevConfig === "object"
    ) ? AccountingHelpersDevConfig : null;
    const updateURL = script.updateURL || script.updateUrl || "";
    const downloadURL = script.downloadURL || script.downloadUrl || "";
    const name = script.name || "";
    const mode = devConfig || /dev/i.test(name) || /127\.0\.0\.1|localhost/i.test(`${updateURL} ${downloadURL}`) ? "dev" : "release";
    return {
      name: name || (devConfig ? "Accounting Helpers Dev" : ""),
      namespace: script.namespace || "",
      version: script.version || devConfig?.bootstrapVersion || "",
      updateURL: updateURL || (devConfig?.origin ? `${devConfig.origin}/userscript/accounting-helpers.dev.user.js` : ""),
      downloadURL: downloadURL || (devConfig?.origin ? `${devConfig.origin}/userscript/accounting-helpers.dev.user.js` : ""),
      mode
    };
  }

  function storageBackend() {
    if (typeof ah.core.storage?.backend === "function") return ah.core.storage.backend();
    const gm = gmAvailable();
    if (gm.get && gm.set) return "GM";
    if (typeof localStorage === "object") return "localStorage";
    return "unknown";
  }

  function keyExists(key) {
    if (typeof ah.core.storage?.has === "function") return ah.core.storage.has(key);
    const sentinel = { __accountingHelpersMissing: true };
    return ah.core.storage.get(key, sentinel) !== sentinel;
  }

  function storageDiagnostics() {
    const keys = ah.core.constants.storageKeys;
    return {
      backend: storageBackend(),
      gmAvailable: gmAvailable(),
      keys: {
        settingsKey: keys.settings,
        settingsExists: keyExists(keys.settings),
        backupKey: keys.settingsBackup,
        backupExists: keyExists(keys.settingsBackup),
        auditLogKey: keys.settingsAuditLog,
        auditLogExists: keyExists(keys.settingsAuditLog),
        metaKey: keys.settingsMeta,
        metaExists: keyExists(keys.settingsMeta),
        pendingPayloadKey: keys.aliPendingPayload,
        pendingPayloadExists: keyExists(keys.aliPendingPayload)
      },
      listedKeys: typeof ah.core.storage.keys === "function" ? ah.core.storage.keys() : []
    };
  }

  function settingsDiagnostics() {
    const settings = ah.core.settings.all();
    const status = ah.core.settings.status?.() || {};
    const audit = ah.core.settings.getAuditLog?.() || [];
    return {
      exists: keyExists(ah.core.constants.storageKeys.settings),
      hasDefaultVendor: !!settings.wave?.defaultAliExpressVendor,
      hasDefaultAccount: !!settings.wave?.defaultAliExpressAccount,
      hasDefaultCategory: !!settings.wave?.defaultAliExpressCategory,
      defaultType: settings.wave?.defaultAliExpressType || "",
      autoCreateWithdrawal: !!settings.aliToWave?.autoCreateWithdrawal,
      autoFillPending: !!settings.aliToWave?.autoFillPending,
      allowReimport: !!settings.aliToWave?.allowReimport,
      backupExists: !!status.backupExists,
      backupSavedAt: status.backupSavedAt || "",
      auditLogExists: !!status.auditLogExists,
      auditEventCount: status.auditEventCount || 0,
      lastSavedAt: status.lastSavedAt || "",
      lastResetAt: status.lastResetAt || "",
      lastAuditAt: status.lastAuditAt || "",
      lastAuditAction: status.lastAuditAction || "",
      recentAuditEvents: audit.slice(-10).map((event) => ({
        at: event.at,
        action: event.action,
        source: event.source,
        backend: event.backend,
        settingsExists: event.settingsExists,
        backupExists: event.backupExists
      }))
    };
  }

  function toIso(value) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp)) return value || "";
    try {
      return new Date(timestamp).toISOString();
    } catch (_error) {
      return String(value || "");
    }
  }

  function pendingPayloadDiagnostics(payload) {
    const stored = payload === undefined ?
      ah.core.storage.get(ah.core.constants.storageKeys.aliPendingPayload, null) :
      payload;
    const valid = ah.features.aliToWave.payload?.isValidPayload?.(stored) || false;
    const errors = [];
    if (stored && !valid) {
      if (stored.version !== ah.features.aliToWave.payload?.ALI_TO_WAVE_PAYLOAD_VERSION) errors.push("version mismatch");
      if (stored.source !== "aliexpress") errors.push("source is not aliexpress");
      if (stored.target !== "wave") errors.push("target is not wave");
      if (!stored.orderId) errors.push("missing orderId");
      if (!Number.isFinite(Number(stored.amount?.value))) errors.push("invalid amount");
    }
    return {
      exists: !!stored,
      valid,
      source: stored?.source || "",
      target: stored?.target || "",
      orderId: stored?.orderId || "",
      amount: stored?.amount?.value || "",
      currency: stored?.amount?.currency || "",
      createdAt: toIso(stored?.createdAt),
      errors
    };
  }

  function pageDiagnostics() {
    return {
      url: location.href,
      isWave: !!ah.sites.wave?.detect?.isWave?.(),
      isAliExpress: !!ah.sites.aliexpress?.detect?.isAliExpress?.(),
      isAliExpressOrderPage: !!ah.sites.aliexpress?.detect?.isOrderPage?.(),
      isAliExpressCartPage: !!ah.sites.aliexpress?.detect?.isCartPage?.()
    };
  }

  function findAddVendorButton(root) {
    return ah.core.dom.findByText(root || document, ah.sites.wave?.selectors?.buttons || "button, [role='button']", "Add vendor") || null;
  }

  function waveFieldState() {
    const modal = ah.sites.wave?.transactionModal?.findOpenModal?.() || null;
    if (!modal) {
      return {
        date: false,
        description: false,
        amount: false,
        type: false,
        account: false,
        category: false,
        vendor: false,
        addVendorButton: false
      };
    }
    return {
      date: !!ah.sites.wave?.transactionModal?.findField?.(["date"]),
      description: !!ah.sites.wave?.transactionModal?.findField?.(["description", "notes"]),
      amount: !!ah.sites.wave?.transactionModal?.findField?.(["amount", "total"]),
      type: !!ah.sites.wave?.transactionModal?.findField?.(["type"]),
      account: !!ah.sites.wave?.transactionModal?.findField?.(["account", "payment account"]),
      category: !!ah.sites.wave?.transactionModal?.findField?.(["category"]),
      vendor: !!ah.sites.wave?.transactionModal?.findField?.(["vendor", "payee", "merchant"]),
      addVendorButton: !!findAddVendorButton(modal || document)
    };
  }

  function dropdownDiagnostics() {
    if (typeof ah.sites.wave?.dropdowns?.diagnostics === "function") {
      return ah.sites.wave.dropdowns.diagnostics();
    }
    const selector = "[role='listbox'], [role='menu'], [role='option'], [role='menuitemradio'], .wv-select__menu, .wv-select__menu__option";
    const openCount = ah.core.dom.visible(ah.core.dom.qsa(selector)).length;
    return { anyOpen: openCount > 0, openCount };
  }

  async function waveDiagnostics() {
    const isWave = !!ah.sites.wave?.detect?.isWave?.();
    const modalBefore = ah.sites.wave?.transactionModal?.findOpenModal?.() || null;
    const heartbeatRecent = typeof ah.sites.wave?.heartbeat?.requestRecent === "function" ?
      await ah.sites.wave.heartbeat.requestRecent(800) :
      !!ah.sites.wave?.heartbeat?.isRecent?.();
    const addTransaction = ah.sites.wave?.transactionList?.findAddTransactionButton?.() || null;
    const addWithdrawal = ah.sites.wave?.transactionList?.findAddWithdrawalMenuItem?.() || null;
    const fields = isWave ? waveFieldState() : {
      date: false,
      description: false,
      amount: false,
      type: false,
      account: false,
      category: false,
      vendor: false,
      addVendorButton: false
    };
    const dropdowns = isWave ? dropdownDiagnostics() : { anyOpen: false, openCount: 0 };
    return {
      heartbeatRecent,
      transactionsPageLikely: !!ah.sites.wave?.detect?.isTransactionsPage?.(),
      addTransactionButtonFound: !!addTransaction,
      addWithdrawalMenuItemFound: !!addWithdrawal,
      modalOpen: !!modalBefore,
      modalStillOpenAfterDiagnostics: !!(modalBefore && ah.sites.wave?.transactionModal?.findOpenModal?.()),
      fields,
      dropdowns
    };
  }

  function requiredConfiguredFields(payload) {
    const settings = ah.core.settings.all();
    return {
      vendor: payload?.wave?.vendor || settings.wave?.defaultAliExpressVendor || "",
      account: payload?.wave?.account || settings.wave?.defaultAliExpressAccount || "",
      category: payload?.wave?.category || settings.wave?.defaultAliExpressCategory || "",
      type: payload?.wave?.type || settings.wave?.defaultAliExpressType || ""
    };
  }

  function preflightWaveImport(payload) {
    const pending = payload || ah.core.storage.get(ah.core.constants.storageKeys.aliPendingPayload, null);
    const payloadValid = !!ah.features.aliToWave.payload?.isValidPayload?.(pending);
    const fields = waveFieldState();
    const modalOpen = !!ah.sites.wave?.transactionModal?.findOpenModal?.();
    const transactionsPageLikely = !!ah.sites.wave?.detect?.isTransactionsPage?.();
    const addTransactionButtonFound = !!ah.sites.wave?.transactionList?.findAddTransactionButton?.();
    const configured = requiredConfiguredFields(pending);
    const missing = [];
    const warnings = [];
    const errors = [];

    if (!pending) errors.push("no pending payload");
    else if (!payloadValid) errors.push("pending payload is invalid");

    if (!ah.sites.wave?.detect?.isWave?.()) warnings.push("current page is not Wave");
    if (!configured.account) warnings.push("default account is not configured");
    if (!configured.category) warnings.push("default category is not configured");
    if (!configured.vendor) warnings.push("default vendor is not configured");

    if (modalOpen) {
      ["date", "description", "amount", "type"].forEach((name) => {
        if (!fields[name]) missing.push(name);
      });
      if (configured.account && !fields.account) missing.push("account");
      if (configured.category && !fields.category) missing.push("category");
      if (configured.vendor && !fields.vendor && !fields.addVendorButton) missing.push("vendor");
    } else if (!transactionsPageLikely) {
      warnings.push("Wave transactions page is not detected");
    }

    const canFillCurrentModal = modalOpen && missing.length === 0 && payloadValid;
    const canCreateWithdrawal = !modalOpen && transactionsPageLikely && addTransactionButtonFound && payloadValid;
    return {
      ok: (canFillCurrentModal || canCreateWithdrawal) && errors.length === 0,
      canFillCurrentModal,
      canCreateWithdrawal,
      missing,
      warnings,
      errors,
      fields
    };
  }

  async function aliToWaveDiagnostics() {
    const raw = ah.core.storage.get(ah.core.constants.storageKeys.aliPendingPayload, null);
    const pending = pendingPayloadDiagnostics(raw);
    return {
      pendingPayload: pending,
      preflight: raw ? preflightWaveImport(raw) : null,
      importedOrderCount: Object.keys(ah.features.aliToWave.duplicateGuard?.all?.() || {}).length,
      lastFillResult: ah.features.aliToWave.lastFillResult || null
    };
  }

  function aliExpressDiagnostics() {
    return {
      isAliExpress: !!ah.sites.aliexpress?.detect?.isAliExpress?.(),
      isOrderPage: !!ah.sites.aliexpress?.detect?.isOrderPage?.(),
      isCartPage: !!ah.sites.aliexpress?.detect?.isCartPage?.()
    };
  }

  async function runDiagnostics() {
    const report = {
      app: {
        version: ah.core.constants.version,
        generatedAt: new Date().toISOString()
      },
      script: scriptMetadata(),
      storage: storageDiagnostics(),
      page: pageDiagnostics(),
      settings: settingsDiagnostics(),
      pendingPayload: pendingPayloadDiagnostics(),
      wave: await waveDiagnostics(),
      aliexpress: aliExpressDiagnostics(),
      aliToWave: await aliToWaveDiagnostics(),
      recentLogs: ah.core.logger?.getLogs?.().slice(-50) || [],
      lastFillResult: ah.features.aliToWave.lastFillResult || null
    };
    lastDiagnostics = report;
    return report;
  }

  async function exportDebugReport() {
    return runDiagnostics();
  }

  async function copyText(text) {
    const errors = [];
    if (typeof GM_setClipboard === "function") {
      try {
        GM_setClipboard(text, "text");
        return true;
      } catch (error) {
        errors.push(`GM_setClipboard: ${String(error)}`);
      }
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        errors.push(`navigator.clipboard: ${String(error)}`);
      }
    }
    try {
      const textarea = ah.core.dom.el("textarea", { style: { position: "fixed", left: "-9999px", top: "0" } }, text);
      document.body.append(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand?.("copy") || false;
      textarea.remove();
      if (ok) return true;
      errors.push("document.execCommand copy returned false");
    } catch (error) {
      errors.push(`document.execCommand: ${String(error)}`);
    }
    ah.core.logger?.warn("Diagnostics clipboard copy failed", { errors });
    return false;
  }

  async function copyDebugReport() {
    const report = await exportDebugReport();
    const text = JSON.stringify(report, null, 2);
    const copied = await copyText(text);
    return { ok: copied, report };
  }

  function stageFakeAliExpressOrder() {
    const payload = ah.features.aliToWave.payload.createAliToWavePayload({
      orderId: "TEST-ALI-ORDER-001",
      orderDate: new Date().toISOString().slice(0, 10),
      cadAmount: "12.34",
      sourceUrl: "accounting-helpers-test"
    });
    payload.debug = { fake: true, autoFillSuppressed: true };
    const ok = ah.features.aliToWave.stageFromAliExpress.savePendingPayload(payload);
    ah.ui.toast.show(ok ? "Staged fake AliExpress order for Wave testing." : "Could not stage fake AliExpress order.", { tone: ok ? "success" : "error" });
    return ok ? payload : null;
  }

  function clearPendingPayload() {
    ah.features.aliToWave.stageFromAliExpress?.clearPendingPayload?.();
  }

  function textareaFor(value) {
    return ah.core.dom.el("textarea", {
      readonly: "readonly",
      class: "ah-diagnostics-output"
    }, JSON.stringify(value, null, 2));
  }

  function summaryFor(report) {
    const pending = report.pendingPayload;
    const wave = report.wave;
    const preflight = report.aliToWave?.preflight;
    const lines = [
      `Script: ${report.script.name || "(unknown)"} ${report.script.version || ""} (${report.script.mode})`,
      `Storage: ${report.storage.backend}; settings ${report.settings.exists ? "exist" : "missing"}; backup ${report.storage.keys.backupExists ? "exists" : "missing"}; audit ${report.storage.keys.auditLogExists ? "exists" : "missing"}`,
      `Pending payload: ${pending.exists ? "yes" : "no"}${pending.exists ? `; valid ${pending.valid ? "yes" : "no"}; ${pending.currency} ${pending.amount}; order ${pending.orderId}` : ""}`,
      `Wave: heartbeat ${wave.heartbeatRecent ? "recent" : "not recent"}; modal ${wave.modalOpen ? "open" : "not open"}; dropdowns ${wave.dropdowns.openCount}`,
      `Ready to fill: ${preflight ? (preflight.ok ? "yes" : "no") : "no pending payload"}`
    ];
    return ah.core.dom.el("div", { class: "ah-diagnostics-summary" }, lines.map((line) => ah.core.dom.el("div", {}, line)));
  }

  function renderReport(container, report) {
    container.replaceChildren(summaryFor(report), textareaFor(report));
  }

  function openModal() {
    ah.ui.styles.ensureStyles();
    document.getElementById(modalId)?.remove();
    const backdrop = ah.core.dom.el("div", { id: modalId, class: "ah-modal-backdrop" });
    const modal = ah.core.dom.el("div", { class: "ah-modal ah-diagnostics-modal", role: "dialog", "aria-modal": "true" });
    const output = ah.core.dom.el("div", { class: "ah-diagnostics-report" }, [
      ah.core.dom.el("div", { class: "ah-help" }, "Run diagnostics to inspect script identity, storage, settings presence, pending payload state, Wave field readiness, dropdown state, and recent logs.")
    ]);

    const runAndRender = async () => {
      const report = await runDiagnostics();
      renderReport(output, report);
      return report;
    };

    modal.append(
      ah.core.dom.el("div", { class: "ah-settings-header" }, [
        ah.core.dom.el("div", {}, [
          ah.core.dom.el("h1", {}, "Diagnostics/Test"),
          ah.core.dom.el("p", {}, `Accounting Helpers ${ah.core.constants.version}`)
        ]),
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-icon-button",
          title: "Close diagnostics.",
          onclick: () => backdrop.remove()
        }, "X")
      ]),
      ah.core.dom.el("div", { class: "ah-diagnostics-body" }, [
        ah.core.dom.el("div", { class: "ah-pill-row" }, [
          ah.core.dom.el("button", { type: "button", class: "ah-button", onclick: runAndRender }, "Run diagnostics"),
          ah.core.dom.el("button", {
            type: "button",
            class: "ah-button ah-button-secondary",
            onclick: async () => {
              const existingText = output.querySelector("textarea")?.value || "";
              let report = null;
              let text = existingText;
              if (!text) {
                report = await exportDebugReport();
                text = JSON.stringify(report, null, 2);
              } else {
                try {
                  report = JSON.parse(text);
                } catch (_error) {
                  report = await exportDebugReport();
                  text = JSON.stringify(report, null, 2);
                }
              }
              const ok = await copyText(text);
              if (report) renderReport(output, report);
              ah.ui.toast.show(ok ? "Diagnostics JSON copied." : "Could not copy diagnostics JSON.", { tone: ok ? "success" : "warn" });
            }
          }, "Copy diagnostics JSON"),
          ah.core.dom.el("button", {
            type: "button",
            class: "ah-button ah-button-secondary",
            onclick: async () => {
              stageFakeAliExpressOrder();
              await runAndRender();
            }
          }, "Stage fake AliExpress order"),
          ah.core.dom.el("button", {
            type: "button",
            class: "ah-button ah-button-secondary",
            onclick: async () => {
              clearPendingPayload();
              await runAndRender();
            }
          }, "Clear pending payload"),
          ah.core.dom.el("button", {
            type: "button",
            class: "ah-button ah-button-secondary",
            onclick: () => output.replaceChildren(textareaFor(pendingPayloadDiagnostics()))
          }, "Show pending payload"),
          ah.core.dom.el("button", {
            type: "button",
            class: "ah-button ah-button-secondary",
            onclick: async () => renderReport(output, await exportDebugReport())
          }, "Export debug report")
        ]),
        output
      ])
    );
    backdrop.append(modal);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) backdrop.remove();
    });
    document.body.append(backdrop);
  }

  function ensure() {
    if (!ah.sites.wave?.detect?.isWave?.() && !ah.sites.aliexpress?.detect?.isAliExpress?.()) return;
    if (document.getElementById(panelId)) return;
    const panel = ah.core.dom.el("div", { id: panelId }, [
      ah.core.dom.el("button", {
        type: "button",
        class: "ah-button",
        title: "Open Accounting Helpers diagnostics and test controls.",
        onclick: openModal
      }, "Diagnostics/Test")
    ]);
    document.body.append(panel);
  }

  ah.features.aliToWave.preflightWaveImport = preflightWaveImport;
  ah.features.diagnostics = {
    ensure,
    open: openModal,
    runDiagnostics,
    runStorageDiagnostics: storageDiagnostics,
    runWaveDiagnostics: waveDiagnostics,
    runAliToWaveDiagnostics: aliToWaveDiagnostics,
    exportDebugReport,
    copyDebugReport,
    getLastDiagnostics() {
      return lastDiagnostics;
    },
    stageFakeAliExpressOrder
  };
})();
