(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  const keys = ah.core.constants.storageKeys;
  const KEY = keys.settings;
  const BACKUP_KEY = keys.settingsBackup;
  const AUDIT_KEY = keys.settingsAuditLog;
  const META_KEY = keys.settingsMeta;
  const maxAuditEvents = 100;
  let startupChecked = false;

  const defaults = {
    wave: {
      defaultAliExpressVendor: "",
      defaultAliExpressCategory: "",
      defaultAliExpressAccount: "",
      defaultAliExpressType: "Withdrawal",
      descriptionPrefix: "Ali | ",
      autoUpdateTaxPopover: false,
      markReviewedAutoSave: false,
      accounts: {
        amex: "",
        cashOnHand: "",
        creditCard: ""
      }
    },
    aliExpress: {
      defaultCurrency: "USD",
      targetCurrency: "CAD"
    },
    aliToWave: {
      autoOpenWave: false,
      autoCreateWithdrawal: false,
      autoFillPending: false,
      allowReimport: false
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function merge(base, override) {
    const output = clone(base);
    if (!override || typeof override !== "object") return output;
    Object.keys(override).forEach((key) => {
      if (
        output[key] &&
        typeof output[key] === "object" &&
        !Array.isArray(output[key]) &&
        typeof override[key] === "object" &&
        !Array.isArray(override[key])
      ) {
        output[key] = merge(output[key], override[key]);
      } else {
        output[key] = override[key];
      }
    });
    return output;
  }

  function pathGet(source, path, fallback) {
    const value = path.split(".").reduce((current, part) => {
      if (current && Object.prototype.hasOwnProperty.call(current, part)) return current[part];
      return undefined;
    }, source);
    return value === undefined ? fallback : value;
  }

  function pathSet(source, path, value) {
    const parts = path.split(".");
    let current = source;
    parts.slice(0, -1).forEach((part) => {
      current[part] = current[part] && typeof current[part] === "object" ? current[part] : {};
      current = current[part];
    });
    current[parts[parts.length - 1]] = value;
    return source;
  }

  function keyExists(key) {
    return typeof ah.core.storage.has === "function" ? ah.core.storage.has(key) : ah.core.storage.get(key, null) !== null;
  }

  function backend() {
    return typeof ah.core.storage.backend === "function" ? ah.core.storage.backend() : "unknown";
  }

  function scriptInfo() {
    const info = typeof GM_info === "object" && GM_info ? GM_info : {};
    const script = info.script || {};
    const devConfig = (
      typeof AccountingHelpersDevConfig !== "undefined" &&
      AccountingHelpersDevConfig &&
      typeof AccountingHelpersDevConfig === "object"
    ) ? AccountingHelpersDevConfig : null;
    const updateURL = script.updateURL || script.updateUrl || "";
    const downloadURL = script.downloadURL || script.downloadUrl || "";
    const name = script.name || (devConfig ? "Accounting Helpers Dev" : "");
    return {
      scriptName: name,
      scriptNamespace: script.namespace || "",
      scriptVersion: script.version || devConfig?.bootstrapVersion || ah.core.constants.version || "",
      updateURL: updateURL || (devConfig?.origin ? `${devConfig.origin}/userscript/accounting-helpers.dev.user.js` : ""),
      downloadURL: downloadURL || (devConfig?.origin ? `${devConfig.origin}/userscript/accounting-helpers.dev.user.js` : "")
    };
  }

  function auditLog() {
    const existing = ah.core.storage.get(AUDIT_KEY, []);
    return Array.isArray(existing) ? existing : [];
  }

  function writeMeta(patch) {
    const existing = ah.core.storage.get(META_KEY, {});
    const next = Object.assign({}, existing && typeof existing === "object" ? existing : {}, patch);
    ah.core.storage.set(META_KEY, next);
    return next;
  }

  function appendAudit(action, source, detail) {
    const now = new Date().toISOString();
    const info = scriptInfo();
    const event = Object.assign({
      at: now,
      action,
      source: source || "unknown",
      backend: backend(),
      scriptName: info.scriptName,
      scriptNamespace: info.scriptNamespace,
      scriptVersion: info.scriptVersion,
      settingsExists: keyExists(KEY),
      backupExists: keyExists(BACKUP_KEY)
    }, detail ? { detail } : {});
    const next = auditLog().concat(event).slice(-maxAuditEvents);
    const ok = ah.core.storage.set(AUDIT_KEY, next);
    if (ok) writeMeta({ lastAuditAt: now, lastAuditAction: action });
    return event;
  }

  function all() {
    return merge(defaults, ah.core.storage.get(KEY, {}));
  }

  function backup() {
    const stored = ah.core.storage.get(BACKUP_KEY, null);
    return stored && typeof stored === "object" ? stored : null;
  }

  function writeBackup(settings, source) {
    const info = scriptInfo();
    const savedAt = new Date().toISOString();
    const payload = Object.assign({
      savedAt,
      backend: backend(),
      settings: clone(settings)
    }, info);
    const ok = ah.core.storage.set(BACKUP_KEY, payload);
    if (ok) {
      appendAudit("backup-written", source || "unknown", { savedAt });
    } else {
      ah.core.logger?.warn("Settings backup write failed", { key: BACKUP_KEY });
    }
    return ok;
  }

  function save(nextSettings, options) {
    const source = options?.source || "unknown";
    const next = merge(defaults, nextSettings);
    const ok = ah.core.storage.set(KEY, next);
    if (ok) {
      const savedAt = new Date().toISOString();
      writeMeta({ lastSavedAt: savedAt });
      appendAudit("save", source, { savedAt });
      writeBackup(next, source);
      window.dispatchEvent(new CustomEvent(ah.core.constants.events.settingsChanged, { detail: all() }));
    }
    return ok;
  }

  function get(path, fallback) {
    return pathGet(all(), path, fallback);
  }

  function set(path, value, options) {
    const next = all();
    pathSet(next, path, value);
    return save(next, options);
  }

  function reset(options) {
    const source = options?.source || "unknown";
    appendAudit("reset", source, { phase: "before" });
    const ok = ah.core.storage.remove(KEY);
    const resetAt = new Date().toISOString();
    writeMeta({ lastResetAt: resetAt });
    appendAudit("reset", source, { phase: "after", ok, resetAt });
    window.dispatchEvent(new CustomEvent(ah.core.constants.events.settingsChanged, { detail: all() }));
    return ok;
  }

  function exportSettings(source) {
    appendAudit("export", source || "unknown");
    const info = scriptInfo();
    return {
      exportedAt: new Date().toISOString(),
      app: "Accounting Helpers",
      appVersion: ah.core.constants.version,
      scriptName: info.scriptName,
      scriptNamespace: info.scriptNamespace,
      scriptVersion: info.scriptVersion,
      backend: backend(),
      settings: all()
    };
  }

  function settingsFromImport(value) {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const candidate = parsed?.settings || parsed;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error("Import JSON must contain a settings object.");
    }
    if (!candidate.wave && !candidate.aliExpress && !candidate.aliToWave) {
      throw new Error("Import JSON does not look like Accounting Helpers settings.");
    }
    return merge(defaults, candidate);
  }

  function importSettings(value, options) {
    const source = options?.source || "import";
    const imported = settingsFromImport(value);
    const ok = save(imported, { source });
    if (ok) appendAudit("import", source);
    return ok;
  }

  function restoreBackup(options) {
    const source = options?.source || "settings-modal";
    const stored = backup();
    if (!stored?.settings) {
      appendAudit("restore-backup", source, { ok: false, reason: "missing-backup" });
      return false;
    }
    const ok = save(stored.settings, { source });
    appendAudit("restore-backup", source, { ok, savedAt: stored.savedAt || "" });
    return ok;
  }

  function clearAuditLog() {
    return ah.core.storage.remove(AUDIT_KEY);
  }

  function status() {
    const storedBackup = backup();
    const meta = ah.core.storage.get(META_KEY, {});
    const log = auditLog();
    const lastAudit = log[log.length - 1] || null;
    const info = scriptInfo();
    return {
      backend: backend(),
      script: info,
      settingsExists: keyExists(KEY),
      backupExists: !!storedBackup,
      auditLogExists: keyExists(AUDIT_KEY),
      auditEventCount: log.length,
      backupSavedAt: storedBackup?.savedAt || "",
      lastSavedAt: meta?.lastSavedAt || storedBackup?.savedAt || "",
      lastResetAt: meta?.lastResetAt || "",
      lastAuditAt: lastAudit?.at || meta?.lastAuditAt || "",
      lastAuditAction: lastAudit?.action || meta?.lastAuditAction || ""
    };
  }

  function startupCheck(options) {
    if (startupChecked) return status();
    startupChecked = true;
    appendAudit("storage-backend-detected", "startup");
    const settingsExists = keyExists(KEY);
    const backupExists = keyExists(BACKUP_KEY);
    appendAudit(settingsExists ? "startup-loaded-settings" : "startup-missing-settings", "startup");
    if (settingsExists && !backupExists) {
      writeBackup(all(), "startup");
    }
    if (!settingsExists && backupExists && options?.showWarning !== false) {
      ah.ui?.toast?.show?.("Accounting Helpers settings are missing, but a backup exists. Open Settings to restore.", {
        title: "Settings backup available",
        tone: "warn"
      });
    }
    return status();
  }

  ah.core.settings = {
    defaults: clone(defaults),
    all,
    save,
    get,
    set,
    reset,
    backup,
    restoreBackup,
    exportSettings,
    importSettings,
    settingsFromImport,
    getAuditLog: auditLog,
    clearAuditLog,
    status,
    startupCheck,
    appendAudit
  };
})();
