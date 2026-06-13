// ==UserScript==
// @name         Accounting Helpers
// @namespace    https://github.com/AnhDuck/accounting-helpers-tamper
// @version      0.1.22
// @description  Modular accounting workflow helpers for WaveApps, AliExpress, and future sites.
// @match        https://next.waveapps.com/*
// @match        https://www.aliexpress.com/p/order/index.html*
// @match        https://www.aliexpress.com/p/shoppingcart/index.html*
// @updateURL    https://raw.githubusercontent.com/AnhDuck/accounting-helpers-tamper/master/userscript/accounting-helpers.release.user.js
// @downloadURL  https://raw.githubusercontent.com/AnhDuck/accounting-helpers-tamper/master/userscript/accounting-helpers.release.user.js
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      open.er-api.com
// ==/UserScript==


/* src/core/constants.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  ah.core.constants = {
    version: "0.1.22",
    namespace: "accountingHelpers",
    storageKeys: {
      settings: "accountingHelpers.settings",
      settingsBackup: "accountingHelpers.settings.backup",
      settingsAuditLog: "accountingHelpers.settings.auditLog",
      settingsMeta: "accountingHelpers.settings.meta",
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


/* src/core/logger.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  const logs = [];
  const maxLogs = 200;

  function write(level, message, detail) {
    const entry = {
      level,
      message,
      detail: detail === undefined ? null : detail,
      at: new Date().toISOString()
    };
    logs.push(entry);
    while (logs.length > maxLogs) logs.shift();

    const consoleMethod = console[level] || console.log;
    consoleMethod.call(console, "[Accounting Helpers]", message, detail || "");
  }

  ah.core.logger = {
    debug(message, detail) {
      write("debug", message, detail);
    },
    info(message, detail) {
      write("info", message, detail);
    },
    warn(message, detail) {
      write("warn", message, detail);
    },
    error(message, detail) {
      write("error", message, detail);
    },
    getLogs() {
      return logs.slice();
    },
    clearLogs() {
      logs.length = 0;
    }
  };
})();


/* src/core/storage.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  function gmApi(name) {
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

  function localKey(key) {
    return `AccountingHelpers.${key}`;
  }

  function get(key, fallback) {
    try {
      const gmGetValue = gmApi("GM_getValue");
      if (gmGetValue) return gmGetValue(key, fallback);
      const raw = localStorage.getItem(localKey(key));
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      ah.core.logger?.warn("Storage read failed", { key, error: String(error) });
      return fallback;
    }
  }

  function backend() {
    const gmGetValue = gmApi("GM_getValue");
    const gmSetValue = gmApi("GM_setValue");
    if (gmGetValue && gmSetValue) return "GM";
    if (typeof localStorage === "object") return "localStorage";
    return "unknown";
  }

  function has(key) {
    const sentinel = { __accountingHelpersMissing: true };
    return get(key, sentinel) !== sentinel;
  }

  function set(key, value) {
    try {
      const gmSetValue = gmApi("GM_setValue");
      if (gmSetValue) {
        gmSetValue(key, value);
      } else {
        localStorage.setItem(localKey(key), JSON.stringify(value));
      }
      return true;
    } catch (error) {
      ah.core.logger?.error("Storage write failed", { key, error: String(error) });
      return false;
    }
  }

  function remove(key) {
    try {
      const gmDeleteValue = gmApi("GM_deleteValue");
      if (gmDeleteValue) gmDeleteValue(key);
      else localStorage.removeItem(localKey(key));
      return true;
    } catch (error) {
      ah.core.logger?.error("Storage delete failed", { key, error: String(error) });
      return false;
    }
  }

  function keys() {
    try {
      const gmListValues = gmApi("GM_listValues");
      if (gmListValues) return gmListValues();
      const prefix = localKey("");
      return Object.keys(localStorage)
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length));
    } catch (error) {
      ah.core.logger?.warn("Storage list failed", String(error));
      return [];
    }
  }

  function onChange(key, callback) {
    const gmAddValueChangeListener = gmApi("GM_addValueChangeListener");
    if (gmAddValueChangeListener) {
      return gmAddValueChangeListener(key, (_name, oldValue, newValue, remote) => {
        callback(newValue, oldValue, remote);
      });
    }
    window.addEventListener("storage", (event) => {
      if (event.key !== localKey(key)) return;
      callback(JSON.parse(event.newValue), JSON.parse(event.oldValue), true);
    });
    return null;
  }

  ah.core.storage = { get, set, remove, keys, onChange, backend, has };
})();


/* src/core/settings.js */
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


/* src/core/dom.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function text(node) {
    return (node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function el(tagName, attrs, children) {
    const node = document.createElement(tagName);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key === "class") node.className = value;
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
      else if (value !== null && value !== undefined) node.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => {
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function findByText(root, selector, matcher) {
    const normalized = typeof matcher === "string" ? matcher.toLowerCase() : null;
    return qsa(selector, root).find((node) => {
      const value = text(node).toLowerCase();
      return normalized ? value.includes(normalized) : matcher(value, node);
    });
  }

  function visible(nodes) {
    return nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
  }

  function isEditable(node) {
    return node && ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName);
  }

  function getLabelText(field) {
    const id = field.getAttribute("id");
    const labels = [];
    if (id) labels.push(...qsa(`label[for="${CSS.escape(id)}"]`));
    labels.push(field.closest("label"));
    labels.push(field.closest("[aria-label]"));
    labels.push(field.closest("[data-testid]"));
    const parent = field.parentElement;
    const grandparent = parent?.parentElement;
    const previous = parent?.previousElementSibling || field.previousElementSibling;
    labels.push(parent, grandparent, previous);
    return labels.map(text).join(" ").toLowerCase();
  }

  function findFieldByLabel(root, labels) {
    const needles = (Array.isArray(labels) ? labels : [labels]).map((label) => label.toLowerCase());
    const fields = visible(qsa("input, textarea, select, [contenteditable='true'], [role='combobox']", root));
    return fields.find((field) => {
      const haystack = [
        field.getAttribute("name"),
        field.getAttribute("placeholder"),
        field.getAttribute("aria-label"),
        field.getAttribute("data-testid"),
        getLabelText(field)
      ].filter(Boolean).join(" ").toLowerCase();
      return needles.some((needle) => haystack.includes(needle));
    });
  }

  function waitFor(selectorOrFn, options) {
    const timeout = options?.timeout || 8000;
    const interval = options?.interval || 100;
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        const result = typeof selectorOrFn === "function" ? selectorOrFn() : qs(selectorOrFn);
        if (result) {
          resolve(result);
          return;
        }
        if (Date.now() - started > timeout) {
          reject(new Error(`Timed out waiting for ${selectorOrFn}`));
          return;
        }
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  ah.core.dom = { qs, qsa, text, el, findByText, visible, isEditable, findFieldByLabel, waitFor };
})();


/* src/core/react.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  function dispatchInputEvents(input) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setReactInputValue(input, value) {
    if (!input) return false;
    const tag = input.tagName;
    const proto =
      tag === "TEXTAREA" ? HTMLTextAreaElement.prototype :
      tag === "SELECT" ? HTMLSelectElement.prototype :
      HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

    if (setter) setter.call(input, value);
    else input.value = value;

    dispatchInputEvents(input);
    return true;
  }

  function setContentEditableValue(node, value) {
    if (!node) return false;
    node.focus();
    node.textContent = value;
    dispatchInputEvents(node);
    return true;
  }

  function setFieldValue(field, value) {
    if (!field) return false;
    if (field.getAttribute("contenteditable") === "true") return setContentEditableValue(field, value);
    return setReactInputValue(field, value);
  }

  ah.core.react = { setReactInputValue, setContentEditableValue, setFieldValue };
})();


/* src/core/money.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  function parseMoney(value) {
    if (typeof value === "number") return value;
    if (!value) return null;
    const normalized = String(value)
      .replace(/,/g, "")
      .replace(/[^\d.\-()]/g, "")
      .replace(/^\((.*)\)$/, "-$1");
    const number = Number.parseFloat(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function roundCents(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function formatCurrency(value, currency) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    try {
      return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: currency || "CAD",
        currencyDisplay: "narrowSymbol"
      }).format(number);
    } catch (_error) {
      return `${currency || "CAD"} ${number.toFixed(2)}`;
    }
  }

  function extractFirstMoney(text) {
    const match = String(text || "").match(/(?:CA\$|US\$|\$)?\s*-?\d[\d,]*(?:\.\d{2})?/i);
    return match ? parseMoney(match[0]) : null;
  }

  ah.core.money = { parseMoney, roundCents, formatCurrency, extractFirstMoney };
})();


/* src/core/dates.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  function toIsoDate(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  function parseLooseDate(value) {
    if (!value) return "";
    const cleaned = String(value).replace(/\s+/g, " ").trim();
    const date = new Date(cleaned);
    if (!Number.isNaN(date.getTime())) return toIsoDate(date);

    const numeric = cleaned.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})|(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (!numeric) return "";
    if (numeric[1]) return `${numeric[1]}-${numeric[2].padStart(2, "0")}-${numeric[3].padStart(2, "0")}`;
    return `${numeric[6]}-${numeric[4].padStart(2, "0")}-${numeric[5].padStart(2, "0")}`;
  }

  ah.core.dates = { toIsoDate, parseLooseDate };
})();


/* src/core/events.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  function rafThrottle(fn) {
    let pending = false;
    return function throttled(...args) {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        fn.apply(this, args);
      });
    };
  }

  ah.core.events = { rafThrottle };
})();


/* src/ui/styles.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.ui = ah.ui || {};

  function ensureStyles() {
    if (document.getElementById("ah-shared-styles")) return;
    const css = `
      .ah-hidden { display: none !important; }
      .ah-button {
        align-items: center;
        background: #184f61;
        border: 1px solid #123d4a;
        border-radius: 6px;
        color: #fff;
        cursor: pointer;
        display: inline-flex;
        font: 600 13px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
        gap: 6px;
        justify-content: center;
        min-height: 32px;
        padding: 7px 10px;
      }
      .ah-button:hover { background: #216a7e; }
      .ah-button:disabled { cursor: default; opacity: .55; }
      .ah-button-secondary {
        background: #f1f4f5;
        border-color: #a8b7bd;
        color: #16343d;
      }
      .ah-button-secondary:hover { background: #e3eaed; }
      .ah-icon-button {
        align-items: center;
        background: #f2f5f6;
        border: 1px solid #c6d1d5;
        border-radius: 6px;
        color: #243d45;
        cursor: pointer;
        display: inline-flex;
        font: 700 18px/1 system-ui, -apple-system, Segoe UI, sans-serif;
        height: 40px;
        justify-content: center;
        width: 40px;
      }
      .ah-icon-button:hover { background: #e5ecef; }
      .ah-pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
      .ah-toast-layer {
        bottom: 18px;
        display: grid;
        gap: 10px;
        position: fixed;
        right: 18px;
        width: min(460px, calc(100vw - 36px));
        z-index: 2147483647;
      }
      .ah-toast {
        align-items: start;
        background: #102b31;
        border: 1px solid rgba(255,255,255,.12);
        border-left: 5px solid #38a16f;
        border-radius: 8px;
        box-shadow: 0 12px 34px rgba(0,0,0,.28);
        color: #fff;
        display: grid;
        font: 13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
        gap: 10px;
        grid-template-columns: 28px 1fr;
        padding: 12px 14px;
      }
      .ah-toast-icon {
        align-items: center;
        background: rgba(255,255,255,.12);
        border-radius: 50%;
        display: inline-flex;
        font: 800 14px/1 system-ui, sans-serif;
        height: 28px;
        justify-content: center;
        margin-top: 1px;
        width: 28px;
      }
      .ah-toast-icon::before { content: "OK"; font-size: 10px; }
      .ah-toast-warn { border-left-color: #d79a2b; }
      .ah-toast-warn .ah-toast-icon::before { content: "!"; font-size: 15px; }
      .ah-toast-error { border-left-color: #d85a4a; }
      .ah-toast-error .ah-toast-icon::before { content: "X"; font-size: 13px; }
      .ah-toast-copy { min-width: 0; }
      .ah-toast-title {
        display: block;
        font: 800 14px/1.25 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 0 0 3px;
      }
      .ah-toast-body {
        color: #e9f2f4;
        overflow-wrap: anywhere;
        white-space: normal;
      }
      .ah-floating-panel {
        background: #fff;
        border: 1px solid #b9c7cc;
        border-radius: 8px;
        box-shadow: 0 12px 36px rgba(24, 54, 63, .2);
        color: #182f36;
        font: 13px/1.35 system-ui, -apple-system, Segoe UI, sans-serif;
        max-width: min(520px, calc(100vw - 32px));
        padding: 12px;
        position: fixed;
        right: 16px;
        top: 84px;
        z-index: 2147483646;
      }
      .ah-floating-panel strong { display: block; font-size: 14px; margin-bottom: 6px; }
      .ah-ali-to-wave-modal-actions {
        align-items: center;
        background: #f6fafb;
        border: 1px solid #b9c7cc;
        border-radius: 6px;
        color: #182f36;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0 0 12px;
        padding: 10px;
      }
      .ah-ali-to-wave-modal-actions strong { font-size: 13px; margin-right: 4px; }
      .ah-ali-to-wave-modal-actions span { color: #3d5961; font-weight: 600; margin-right: auto; }
      .ah-modal-backdrop {
        align-items: center;
        background: rgba(18, 35, 40, .52);
        display: flex;
        inset: 0;
        justify-content: center;
        padding: 12px;
        position: fixed;
        z-index: 2147483647;
      }
      .ah-modal {
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 18px 54px rgba(0,0,0,.28);
        color: #152d34;
        max-height: min(820px, calc(100vh - 32px));
        overflow: auto;
        width: min(680px, calc(100vw - 32px));
      }
      .ah-settings-modal {
        display: grid;
        height: min(984px, calc(100vh - 24px));
        max-height: calc(100vh - 24px);
        overflow: hidden;
        padding: 0;
        width: min(1120px, calc(100vw - 24px));
      }
      .ah-settings-form {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        height: 100%;
        min-height: 0;
      }
      .ah-settings-header {
        align-items: center;
        background: #fbfdfd;
        border-bottom: 1px solid #c6d4d9;
        display: flex;
        gap: 16px;
        justify-content: space-between;
        padding: 18px 22px;
      }
      .ah-settings-header h1 {
        font: 800 22px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 0;
      }
      .ah-settings-header p {
        color: #60747a;
        font: 600 12px/1.3 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 4px 0 0;
      }
      .ah-settings-body {
        background: #f7fafb;
        display: grid;
        grid-template-columns: 216px minmax(0, 1fr);
        min-height: 0;
      }
      .ah-settings-sidebar {
        background: #e9eff2;
        border-right: 1px solid #c6d4d9;
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow: auto;
        padding: 18px 10px;
      }
      .ah-settings-tab {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: 6px;
        color: #29454d;
        cursor: pointer;
        display: flex;
        font: 800 14px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
        min-height: 44px;
        padding: 10px 12px;
        text-align: left;
        width: 100%;
      }
      .ah-settings-tab:hover { background: #dce7eb; color: #132f37; }
      .ah-settings-tab.is-active {
        background: #173f4b;
        color: #fff;
      }
      .ah-settings-panels {
        background: #fff;
        min-width: 0;
        overflow: auto;
        padding: 24px 30px 30px;
      }
      .ah-settings-panel[hidden] { display: none !important; }
      .ah-settings-tab-intro {
        border-bottom: 1px solid #dfe7ea;
        margin: 0 0 20px;
        padding: 0 0 18px;
      }
      .ah-settings-kicker {
        color: #41616b;
        font: 800 12px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 0 0 6px;
        text-transform: uppercase;
      }
      .ah-settings-tab-intro h2 {
        font: 800 20px/1.25 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 0 0 8px;
      }
      .ah-settings-tab-intro p {
        color: #4d646b;
        font: 13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 0;
        max-width: 760px;
      }
      .ah-settings-section {
        background: #fff;
        border: 1px solid #cbd9de;
        border-radius: 8px;
        margin: 0 0 16px;
        overflow: hidden;
      }
      .ah-settings-section-heading {
        background: #eef5f7;
        border-bottom: 1px solid #cbd9de;
        padding: 14px 16px 12px;
      }
      .ah-settings-section h3 {
        font: 800 15px/1.25 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 0 0 5px;
      }
      .ah-settings-section > .ah-form-grid,
      .ah-settings-section > .ah-check-list,
      .ah-settings-section > .ah-pill-row,
      .ah-settings-section > .ah-overview-grid,
      .ah-settings-section > .ah-settings-data-tools,
      .ah-settings-section > .ah-settings-warning {
        margin: 16px;
      }
      .ah-help { color: #5b7077; font: 12px/1.4 system-ui, sans-serif; margin: 0; }
      .ah-form-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
      .ah-field { display: grid; gap: 6px; min-width: 0; }
      .ah-field label { font: 750 12px/1.25 system-ui, sans-serif; }
      .ah-field input, .ah-field select {
        border: 1px solid #aebdc2;
        box-sizing: border-box;
        border-radius: 6px;
        font: 14px/1.35 system-ui, sans-serif;
        min-height: 44px;
        min-width: 0;
        padding: 10px 12px;
        width: 100%;
      }
      .ah-field select { padding-right: 36px; }
      .ah-field input:focus, .ah-field select:focus {
        border-color: #2b7388;
        box-shadow: 0 0 0 3px rgba(43, 115, 136, .16);
        outline: none;
      }
      .ah-check-list {
        display: grid;
        gap: 10px;
      }
      .ah-setting-check {
        align-items: start;
        background: #fff;
        border: 1px solid #cbd9de;
        border-radius: 8px;
        cursor: pointer;
        display: grid;
        gap: 10px;
        grid-template-columns: auto 1fr;
        margin: 0;
        padding: 12px;
      }
      .ah-setting-check:hover { background: #f5fafb; border-color: #9fb5bd; }
      .ah-setting-check input {
        margin: 2px 0 0;
      }
      .ah-setting-check-copy {
        display: grid;
        gap: 3px;
        min-width: 0;
      }
      .ah-setting-check-title {
        color: #182f36;
        font: 750 13px/1.25 system-ui, -apple-system, Segoe UI, sans-serif;
      }
      .ah-setting-check-help {
        color: #60747a;
        font: 12px/1.4 system-ui, -apple-system, Segoe UI, sans-serif;
      }
      .ah-overview-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .ah-overview-card {
        background: #fff;
        border: 1px solid #cbd9de;
        border-radius: 8px;
        display: grid;
        gap: 5px;
        padding: 12px;
      }
      .ah-overview-card strong {
        color: #182f36;
        font: 800 13px/1.2 system-ui, sans-serif;
      }
      .ah-overview-card span {
        color: #60747a;
        font: 12px/1.4 system-ui, sans-serif;
      }
      .ah-status-warn {
        border-color: #d79a2b;
        background: #fffaf0;
      }
      .ah-settings-warning {
        background: #fff7ed;
        border: 1px solid #d79a2b;
        border-radius: 8px;
        color: #6b3a05;
        display: grid;
        font: 12px/1.45 system-ui, sans-serif;
        gap: 4px;
        padding: 10px 12px;
      }
      .ah-settings-data-tools {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ah-settings-data-stack {
        display: grid;
      }
      .ah-settings-import {
        border: 1px solid #aebdc2;
        border-radius: 8px;
        box-sizing: border-box;
        color: #172f37;
        font: 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
        min-height: 160px;
        padding: 12px;
        resize: vertical;
        width: 100%;
      }
      .ah-check { align-items: center; display: flex; gap: 8px; min-height: 30px; }
      .ah-check input { margin: 0; }
      .ah-modal-actions {
        align-items: center;
        background: #fbfdfd;
        border-top: 1px solid #c6d4d9;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
        padding: 14px 18px;
      }
      .ah-ae-row { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
      .ah-ae-total { color: #184f61; font-weight: 700; }
      #ah-diagnostics-panel {
        bottom: 62px;
        left: 12px;
        position: fixed;
        z-index: 2147483646;
      }
      .ah-diagnostics-modal {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        max-height: calc(100vh - 24px);
        width: min(980px, calc(100vw - 24px));
      }
      .ah-diagnostics-body {
        display: grid;
        gap: 12px;
        min-height: 0;
        overflow: auto;
        padding: 16px;
      }
      .ah-diagnostics-report {
        display: grid;
        gap: 12px;
        min-height: 0;
      }
      .ah-diagnostics-summary {
        background: #f6fafb;
        border: 1px solid #cbd9de;
        border-radius: 8px;
        color: #203b43;
        display: grid;
        font: 12px/1.45 system-ui, sans-serif;
        gap: 4px;
        padding: 10px 12px;
      }
      .ah-diagnostics-output {
        border: 1px solid #aebdc2;
        border-radius: 8px;
        box-sizing: border-box;
        color: #172f37;
        font: 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
        min-height: 360px;
        padding: 12px;
        resize: vertical;
        width: 100%;
      }
      @media (max-width: 760px) {
        .ah-modal-backdrop { align-items: stretch; padding: 8px; }
        .ah-settings-modal { height: calc(100vh - 16px); width: calc(100vw - 16px); }
        .ah-settings-header { padding: 14px; }
        .ah-settings-body {
          grid-template-columns: 1fr;
          grid-template-rows: auto minmax(0, 1fr);
        }
        .ah-settings-sidebar {
          border-bottom: 1px solid #d7e0e3;
          border-right: 0;
          flex-direction: row;
          padding: 10px;
        }
        .ah-settings-tab {
          flex: 0 0 auto;
          min-width: 118px;
        }
        .ah-settings-panels { padding: 16px; }
        .ah-form-grid { grid-template-columns: 1fr; }
      }
    `;

    if (typeof GM_addStyle === "function") {
      GM_addStyle(css);
      const marker = document.createElement("style");
      marker.id = "ah-shared-styles";
      document.head.append(marker);
      return;
    }
    const style = document.createElement("style");
    style.id = "ah-shared-styles";
    style.textContent = css;
    document.head.append(style);
  }

  ah.ui.styles = { ensureStyles };
})();


/* src/ui/toast.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.ui = ah.ui || {};

  const defaultTimeout = 7000;
  const toneTitles = {
    success: "Done",
    warn: "Needs attention",
    error: "Error"
  };

  function ensureToastLayer() {
    let layer = document.getElementById("ah-toast-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "ah-toast-layer";
      layer.className = "ah-toast-layer";
      document.body.append(layer);
    }
    return layer;
  }

  function shouldShowTitle(message, options) {
    return !!options?.title || !!options?.tone || String(message || "").length > 90;
  }

  function toastTitle(message, options) {
    if (options?.title) return options.title;
    if (String(message || "").startsWith("Partially filled Wave transaction")) return "Partial fill";
    return toneTitles[options?.tone] || "Accounting Helpers";
  }

  function show(message, options) {
    const layer = ensureToastLayer();
    const tone = options?.tone || "success";
    const toast = document.createElement("div");
    toast.className = `ah-toast ah-toast-${tone}`;
    toast.setAttribute("role", tone === "error" || tone === "warn" ? "alert" : "status");

    const icon = document.createElement("span");
    icon.className = "ah-toast-icon";
    icon.setAttribute("aria-hidden", "true");

    const copy = document.createElement("div");
    copy.className = "ah-toast-copy";

    if (shouldShowTitle(message, options)) {
      const title = document.createElement("strong");
      title.className = "ah-toast-title";
      title.textContent = toastTitle(message, options);
      copy.append(title);
    }

    const body = document.createElement("div");
    body.className = "ah-toast-body";
    body.textContent = message;
    copy.append(body);

    toast.append(icon, copy);
    layer.append(toast);

    const timeout = options?.timeout === undefined ? defaultTimeout : options.timeout;
    if (timeout > 0) {
      let remaining = timeout;
      let started = Date.now();
      let timer = setTimeout(() => toast.remove(), remaining);
      toast.addEventListener("mouseenter", () => {
        clearTimeout(timer);
        remaining -= Date.now() - started;
      });
      toast.addEventListener("mouseleave", () => {
        started = Date.now();
        timer = setTimeout(() => toast.remove(), Math.max(1000, remaining));
      });
    }
    return toast;
  }

  ah.ui.toast = { ensureToastLayer, show };
})();


/* src/ui/floatingPanel.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.ui = ah.ui || {};

  function ensure(id, render) {
    let panel = document.getElementById(id);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = id;
      panel.className = "ah-floating-panel";
      document.body.append(panel);
    }
    const content = render(panel);
    if (content) {
      panel.replaceChildren(content.nodeType ? content : document.createTextNode(String(content)));
    }
    return panel;
  }

  function remove(id) {
    document.getElementById(id)?.remove();
  }

  ah.ui.floatingPanel = { ensure, remove };
})();


/* src/ui/settingsModal.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.ui = ah.ui || {};

  const tabs = [
    {
      id: "general",
      label: "General",
      kicker: "General settings",
      title: "Wave transaction helpers",
      description: "Defaults and helper behavior used inside Wave transaction screens."
    },
    {
      id: "aliexpress",
      label: "AliExpress",
      kicker: "AliExpress settings",
      title: "Orders, currency, and Wave import",
      description: "AliExpress display settings and controls for staging orders into Wave."
    },
    {
      id: "data",
      label: "Data",
      kicker: "Settings safety",
      title: "Backup, export, and restore",
      description: "Tools for protecting local Accounting Helpers settings."
    },
    {
      id: "about",
      label: "About",
      kicker: "Accounting Helpers",
      title: "What this script does",
      description: "Local browser helpers for Wave and AliExpress accounting workflows."
    }
  ];

  const aliExpressFields = [
    {
      path: "aliExpress.defaultCurrency",
      label: "AliExpress source currency",
      title: "Currency shown by AliExpress before conversion helpers run.",
      help: "Default source currency label for AliExpress helper displays."
    },
    {
      path: "aliExpress.targetCurrency",
      label: "Accounting target currency",
      title: "Currency used by accounting helper displays and staged Wave payloads.",
      help: "Target currency label used by converted totals and staged Wave payloads."
    }
  ];

  const waveDefaultFields = [
    {
      path: "wave.defaultAliExpressVendor",
      label: "Default AliExpress vendor",
      title: "Wave vendor/payee to use when filling a staged AliExpress order.",
      help: "Payee value entered when an AliExpress order fills a Wave transaction."
    },
    {
      path: "wave.defaultAliExpressAccount",
      label: "Default Wave account",
      title: "Wave account field value to use for AliExpress transactions.",
      help: "Payment account value entered for staged AliExpress orders."
    },
    {
      path: "wave.defaultAliExpressCategory",
      label: "Default Wave category",
      title: "Wave category field value to use for AliExpress transactions.",
      help: "Category value entered for staged AliExpress orders."
    },
    {
      path: "wave.descriptionPrefix",
      label: "Description prefix",
      title: "Text placed before the AliExpress order ID in the Wave description.",
      help: "Prepended to the order ID when the Wave description is filled."
    }
  ];

  const helperFields = [
    {
      path: "wave.accounts.amex",
      label: "Imported card account",
      title: "Wave account name to switch away from when an imported card transaction uses the feed account.",
      help: "Type the account Wave starts with after importing the transaction. The Switch account button changes this to the preferred account below, and back again."
    },
    {
      path: "wave.accounts.creditCard",
      label: "Preferred account",
      title: "Wave account name to use instead of the imported card account.",
      help: "Type the Cash & Bank account you want to use instead. The same Switch account button can change this value back to the imported card account."
    }
  ];

  const waveHelperChecks = [
    {
      path: "wave.autoUpdateTaxPopover",
      label: "Update visible tax amount after tax changes",
      title: "Keeps the Wave tax popover display aligned after the tax helper changes a transaction.",
      help: "When a GST/PST helper changes tax, also refresh the amount shown in Wave's tax popover."
    },
    {
      path: "wave.markReviewedAutoSave",
      label: "Save after Mark as reviewed",
      title: "Only affects the explicit Mark as reviewed helper button.",
      help: "After the helper marks a transaction as reviewed, click Wave's Save button automatically."
    }
  ];

  const aliToWaveChecks = [
    {
      path: "aliToWave.allowReimport",
      label: "Allow already imported orders to be staged again",
      title: "When off, orders already filled into Wave are disabled on AliExpress.",
      help: "Leave this off during normal use to avoid accidentally filling the same order twice."
    },
    {
      path: "aliToWave.autoFillPending",
      label: "Auto-fill when a Wave transaction modal is open",
      title: "When on, a pending AliExpress order fills the open Wave transaction without pressing Fill.",
      help: "Only runs when Wave already has an edit transaction modal open."
    },
    {
      path: "aliToWave.autoCreateWithdrawal",
      label: "Create a new Wave withdrawal after staging",
      title: "When on, a staged AliExpress order opens Add withdrawal in Wave and fills it automatically.",
      help: "Only runs when Wave is on the transactions page and no transaction modal is already open."
    },
  ];

  function inputFor(field) {
    const wrapper = ah.core.dom.el("div", { class: "ah-field" });
    const id = `ah-setting-${field.path.replace(/\W/g, "-")}`;
    const input = ah.core.dom.el("input", {
      id,
      type: field.type || "text",
      "data-setting-path": field.path,
      title: field.title || ""
    });
    input.value = ah.core.settings.get(field.path, "");
    wrapper.append(
      ah.core.dom.el("label", { for: id, title: field.title || "" }, field.label),
      input
    );
    if (field.help) wrapper.append(ah.core.dom.el("div", { class: "ah-help" }, field.help));
    return wrapper;
  }

  function selectFor(path, label, options, title, helpText) {
    const wrapper = ah.core.dom.el("div", { class: "ah-field" });
    const id = `ah-setting-${path.replace(/\W/g, "-")}`;
    const select = ah.core.dom.el("select", { id, "data-setting-path": path, title });
    options.forEach((option) => select.append(ah.core.dom.el("option", { value: option }, option)));
    select.value = ah.core.settings.get(path, options[0]);
    wrapper.append(ah.core.dom.el("label", { for: id, title }, label), select);
    if (helpText) wrapper.append(ah.core.dom.el("div", { class: "ah-help" }, helpText));
    return wrapper;
  }

  function checkFor(item) {
    const id = `ah-setting-${item.path.replace(/\W/g, "-")}`;
    const input = ah.core.dom.el("input", {
      id,
      type: "checkbox",
      "data-setting-path": item.path,
      title: item.title || ""
    });
    input.checked = !!ah.core.settings.get(item.path, false);
    return ah.core.dom.el("label", { class: "ah-setting-check", title: item.title || "" }, [
      input,
      ah.core.dom.el("span", { class: "ah-setting-check-copy" }, [
        ah.core.dom.el("span", { class: "ah-setting-check-title" }, item.label),
        ah.core.dom.el("span", { class: "ah-setting-check-help" }, item.help || item.title || "")
      ])
    ]);
  }

  function help(text) {
    return ah.core.dom.el("div", { class: "ah-help" }, text);
  }

  function section(title, children, description) {
    const node = ah.core.dom.el("section", { class: "ah-settings-section" }, [
      ah.core.dom.el("div", { class: "ah-settings-section-heading" }, [
        ah.core.dom.el("h3", {}, title),
        description ? help(description) : null
      ])
    ]);
    children.filter(Boolean).forEach((child) => node.append(child));
    return node;
  }

  function fieldGrid(fields) {
    const grid = ah.core.dom.el("div", { class: "ah-form-grid" });
    fields.forEach((field) => grid.append(inputFor(field)));
    return grid;
  }

  function checkList(items) {
    const list = ah.core.dom.el("div", { class: "ah-check-list" });
    items.forEach((item) => list.append(checkFor(item)));
    return list;
  }

  function captureButton(label, path, read, title) {
    return ah.core.dom.el("button", {
      type: "button",
      class: "ah-button ah-button-secondary",
      title,
      onclick: () => {
        const value = read();
        if (!value) {
          ah.ui.toast.show("No current Wave value found.", { tone: "warn" });
          return;
        }
        const input = document.querySelector(`[data-setting-path="${CSS.escape(path)}"]`);
        if (input) input.value = value;
        ah.core.settings.set(path, value, { source: "settings-modal" });
        ah.ui.toast.show(`${label} saved.`);
      }
    }, label);
  }

  async function copyText(text) {
    if (typeof GM_setClipboard === "function") {
      try {
        GM_setClipboard(text, "text");
        return true;
      } catch (error) {
        ah.core.logger?.warn("Settings clipboard copy failed", { method: "GM_setClipboard", error: String(error) });
      }
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        ah.core.logger?.warn("Settings clipboard copy failed", { method: "navigator.clipboard", error: String(error) });
      }
    }
    try {
      const textarea = ah.core.dom.el("textarea", { style: { position: "fixed", left: "-9999px", top: "0" } }, text);
      document.body.append(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand?.("copy") || false;
      textarea.remove();
      return ok;
    } catch (error) {
      ah.core.logger?.warn("Settings clipboard copy failed", { method: "execCommand", error: String(error) });
      return false;
    }
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = ah.core.dom.el("a", { href: url, download: filename, style: { display: "none" } });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function formatDate(value) {
    if (!value) return "never";
    try {
      return new Date(value).toLocaleString();
    } catch (_error) {
      return String(value);
    }
  }

  function statusCard(label, value, tone) {
    const attrs = { class: tone ? `ah-overview-card ah-status-${tone}` : "ah-overview-card" };
    return ah.core.dom.el("div", attrs, [
      ah.core.dom.el("strong", {}, label),
      ah.core.dom.el("span", {}, value || "unknown")
    ]);
  }

  function settingsStatusSection() {
    const status = ah.core.settings.status();
    const script = status.script || {};
    const statusGrid = ah.core.dom.el("div", { class: "ah-overview-grid" }, [
      statusCard("Storage", status.backend, status.backend === "localStorage" ? "warn" : ""),
      statusCard("Script", `${script.scriptName || "(unknown)"} ${script.scriptVersion || ""}`.trim()),
      statusCard("Settings", status.settingsExists ? "present" : "missing", status.settingsExists ? "" : "warn"),
      statusCard("Backup", status.backupExists ? `present; ${formatDate(status.backupSavedAt)}` : "missing", status.backupExists ? "" : "warn"),
      statusCard("Last saved", formatDate(status.lastSavedAt)),
      statusCard("Last reset", formatDate(status.lastResetAt)),
      statusCard("Audit log", `${status.auditLogExists ? "present" : "missing"}; ${status.auditEventCount} events`),
      statusCard("Last audit event", status.lastAuditAt ? `${formatDate(status.lastAuditAt)} (${status.lastAuditAction || "unknown"})` : "never")
    ]);
    const warnings = [];
    if (status.backend === "localStorage") warnings.push("localStorage fallback is active. Storage is per-site and less reliable than Tampermonkey GM storage.");
    if (/dev/i.test(script.scriptName || "")) warnings.push("You are running the dev userscript. Release script settings may be separate; export settings before switching scripts.");
    const warningNode = warnings.length ?
      ah.core.dom.el("div", { class: "ah-settings-warning" }, warnings.map((item) => ah.core.dom.el("div", {}, item))) :
      null;
    return section("Current settings status", [statusGrid, warningNode], "Use this when settings appear to reset or when switching between dev and release scripts.");
  }

  function settingsExportSection() {
    return section("Export settings", [
      ah.core.dom.el("div", { class: "ah-settings-data-tools" }, [
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button",
          title: "Copy a JSON export of current settings.",
          onclick: async () => {
            const payload = JSON.stringify(ah.core.settings.exportSettings("settings-modal"), null, 2);
            const ok = await copyText(payload);
            ah.ui.toast.show(ok ? "Settings JSON copied." : "Could not copy settings JSON.", { tone: ok ? "success" : "warn" });
          }
        }, "Copy settings JSON"),
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button ah-button-secondary",
          title: "Download a JSON export of current settings.",
          onclick: () => {
            const payload = JSON.stringify(ah.core.settings.exportSettings("settings-modal"), null, 2);
            downloadJson(`accounting-helpers-settings-${new Date().toISOString().slice(0, 10)}.json`, payload);
            ah.ui.toast.show("Settings export downloaded.");
          }
        }, "Download settings JSON")
      ])
    ], "Exports include script metadata, storage backend, timestamp, and settings.");
  }

  function settingsImportSection() {
    const textarea = ah.core.dom.el("textarea", {
      class: "ah-settings-import",
      rows: "8",
      placeholder: "Paste Accounting Helpers settings JSON here."
    });
    return section("Import settings", [
      ah.core.dom.el("div", { class: "ah-settings-data-tools ah-settings-data-stack" }, [
        textarea,
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button",
          title: "Validate and import pasted settings JSON.",
          onclick: () => {
            let imported = null;
            try {
              imported = ah.core.settings.settingsFromImport(textarea.value);
            } catch (error) {
              ah.ui.toast.show(error.message || "Settings import JSON is invalid.", { title: "Import failed", tone: "error" });
              return;
            }
            if (!confirm("Import these Accounting Helpers settings and overwrite current settings? A backup will be written first.")) return;
            const ok = ah.core.settings.importSettings({ settings: imported }, { source: "settings-modal" });
            ah.ui.toast.show(ok ? "Settings imported." : "Settings import failed.", { tone: ok ? "success" : "error" });
            if (ok) {
              close();
              open("data");
            }
          }
        }, "Import settings JSON")
      ])
    ], "Invalid JSON or unrelated data is rejected before anything is overwritten.");
  }

  function restoreBackupSection() {
    const backup = ah.core.settings.backup();
    const label = backup?.savedAt ? `Restore last backup (${formatDate(backup.savedAt)})` : "Restore last backup";
    const attrs = {
      type: "button",
      class: "ah-button ah-button-secondary",
      title: backup ? "Restore settings from the latest automatic backup." : "No settings backup is currently stored.",
      onclick: () => {
        if (!backup) {
          ah.ui.toast.show("No settings backup is available.", { tone: "warn" });
          return;
        }
        if (!confirm("Restore the last Accounting Helpers settings backup and overwrite current settings?")) return;
        const ok = ah.core.settings.restoreBackup({ source: "settings-modal" });
        ah.ui.toast.show(ok ? "Settings restored from backup." : "Settings restore failed.", { tone: ok ? "success" : "error" });
        if (ok) {
          close();
          open("data");
        }
      }
    };
    if (!backup) attrs.disabled = "disabled";
    return section("Restore backup", [
      ah.core.dom.el("div", { class: "ah-settings-data-tools" }, [
        ah.core.dom.el("button", attrs, label)
      ])
    ], backup ? "Restoring uses the normal save path and writes a fresh backup and audit event." : "A backup is written automatically after each successful settings save.");
  }

  function captureSection() {
    if (!ah.sites.wave?.detect?.isWave()) return null;
    const captureRow = ah.core.dom.el("div", { class: "ah-pill-row" }, [
      captureButton("Copy account", "wave.defaultAliExpressAccount", () =>
        ah.sites.wave.transactionModal.readField(["account", "payment account"]),
        "Copy the visible Wave Account field into the default AliExpress account setting."
      ),
      captureButton("Copy category", "wave.defaultAliExpressCategory", () =>
        ah.sites.wave.transactionModal.readField(["category"]),
        "Copy the visible Wave Category field into the default AliExpress category setting."
      ),
      captureButton("Copy vendor", "wave.defaultAliExpressVendor", () =>
        ah.sites.wave.transactionModal.readField(["vendor", "payee", "merchant"]),
        "Copy the visible Wave Vendor/Payee field into the default AliExpress vendor setting."
      )
    ]);
    return section(
      "Copy from the open Wave transaction",
      [captureRow],
      "Optional shortcut for AliExpress defaults: open a Wave edit transaction first, then copy the visible Account, Category, or Vendor/Payee value into the fields above."
    );
  }

  function tabIntro(tab) {
    return ah.core.dom.el("div", { class: "ah-settings-tab-intro" }, [
      ah.core.dom.el("div", { class: "ah-settings-kicker" }, tab.kicker),
      ah.core.dom.el("h2", {}, tab.title),
      ah.core.dom.el("p", {}, tab.description)
    ]);
  }

  function overviewGrid() {
    return ah.core.dom.el("div", { class: "ah-overview-grid" }, [
      ah.core.dom.el("div", { class: "ah-overview-card" }, [
        ah.core.dom.el("strong", {}, "Storage"),
        ah.core.dom.el("span", {}, "Saved locally in Tampermonkey for this browser.")
      ]),
      ah.core.dom.el("div", { class: "ah-overview-card" }, [
        ah.core.dom.el("strong", {}, "Wave"),
        ah.core.dom.el("span", {}, "Fills transaction fields, switches accounts, and assists review/tax actions.")
      ]),
      ah.core.dom.el("div", { class: "ah-overview-card" }, [
        ah.core.dom.el("strong", {}, "AliExpress"),
        ah.core.dom.el("span", {}, "Converts order totals, copies CAD values, and stages orders for Wave.")
      ]),
      ah.core.dom.el("div", { class: "ah-overview-card" }, [
        ah.core.dom.el("strong", {}, "Future tabs"),
        ah.core.dom.el("span", {}, "Add platform-specific settings here without mixing workflows together.")
      ])
    ]);
  }

  function panelFor(tab) {
    const panel = ah.core.dom.el("div", {
      id: `ah-settings-panel-${tab.id}`,
      class: "ah-settings-panel",
      role: "tabpanel",
      "aria-labelledby": `ah-settings-tab-${tab.id}`,
      "data-settings-panel": tab.id
    }, [tabIntro(tab)]);

    if (tab.id === "general") {
      panel.append(
        section("Wave account switcher", [
          fieldGrid(helperFields),
          checkList(waveHelperChecks)
        ], "For imported card transactions: type the account Wave starts with and the account you actually want. The floating Switch account button changes the Account field between those two values.")
      );
    }

    if (tab.id === "aliexpress") {
      const capture = captureSection();
      panel.append(
        section("Currencies", [
          fieldGrid(aliExpressFields)
        ], "Used by AliExpress order total conversion and copy helpers."),
        section("Wave defaults for AliExpress orders", [
          fieldGrid(waveDefaultFields),
          selectFor(
            "wave.defaultAliExpressType",
            "Default Wave transaction type",
            ["Withdrawal", "Deposit"],
            "Wave transaction type to use when filling a staged AliExpress order.",
            "Applied when an AliExpress order fills a Wave transaction."
          )
        ], "Values used when a staged AliExpress order fills fields in Wave."),
        section("Staging and fill behavior", [
          checkList(aliToWaveChecks)
        ], "Clicking Stage for Wave stores one pending order. If Wave is already open, no duplicate tab is opened.")
      );
      if (capture) panel.append(capture);
    }

    if (tab.id === "data") {
      panel.append(
        settingsStatusSection(),
        restoreBackupSection(),
        settingsExportSection(),
        settingsImportSection()
      );
    }

    if (tab.id === "about") {
      panel.append(
        section("Overview", [
          overviewGrid()
        ], "Settings are stored locally in Tampermonkey for this browser.")
      );
    }

    return panel;
  }

  function activateTab(modal, tabId) {
    modal.querySelectorAll("[data-settings-tab]").forEach((tab) => {
      const selected = tab.getAttribute("data-settings-tab") === tabId;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    modal.querySelectorAll("[data-settings-panel]").forEach((panel) => {
      const selected = panel.getAttribute("data-settings-panel") === tabId;
      panel.hidden = !selected;
    });
  }

  function sidebarFor(modal) {
    return ah.core.dom.el("nav", { class: "ah-settings-sidebar", "aria-label": "Settings sections" },
      tabs.map((tab) => ah.core.dom.el("button", {
        id: `ah-settings-tab-${tab.id}`,
        type: "button",
        class: "ah-settings-tab",
        role: "tab",
        "aria-selected": "false",
        "aria-controls": `ah-settings-panel-${tab.id}`,
        "data-settings-tab": tab.id,
        onclick: () => activateTab(modal, tab.id)
      }, [
        ah.core.dom.el("span", {}, tab.label)
      ]))
    );
  }

  function open(initialTab) {
    const startingTab = typeof initialTab === "string" ? initialTab : "general";
    ah.ui.styles.ensureStyles();
    document.getElementById("ah-settings-modal")?.remove();

    const settings = ah.core.settings.all();
    const backdrop = ah.core.dom.el("div", { id: "ah-settings-modal", class: "ah-modal-backdrop" });
    const modal = ah.core.dom.el("div", { class: "ah-modal ah-settings-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "ah-settings-title" });

    const form = ah.core.dom.el("form", { class: "ah-settings-form" });
    const closeButton = ah.core.dom.el("button", {
      type: "button",
      class: "ah-icon-button",
      title: "Close settings without saving changes.",
      "aria-label": "Close settings",
      onclick: close
    }, "X");

    const header = ah.core.dom.el("div", { class: "ah-settings-header" }, [
      ah.core.dom.el("div", {}, [
        ah.core.dom.el("h1", { id: "ah-settings-title" }, "Settings"),
        ah.core.dom.el("p", {}, "Accounting Helpers")
      ]),
      closeButton
    ]);

    const panels = ah.core.dom.el("div", { class: "ah-settings-panels" }, tabs.map(panelFor));
    const body = ah.core.dom.el("div", { class: "ah-settings-body" });
    body.append(sidebarFor(modal), panels);

    const actions = ah.core.dom.el("div", { class: "ah-modal-actions" }, [
      ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        title: "Close without saving changes.",
        onclick: close
      }, "Cancel"),
      ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        title: "Clear all Accounting Helpers settings stored by Tampermonkey.",
        onclick: () => {
          if (confirm("Reset Accounting Helpers settings to defaults? The last backup and audit log will be kept so settings can still be restored.")) {
            ah.core.settings.reset({ source: "settings-modal" });
            close();
            ah.ui.toast.show("Settings reset. Last backup was kept.", { title: "Settings reset", tone: "warn" });
          }
        }
      }, "Reset"),
      ah.core.dom.el("button", { type: "submit", class: "ah-button", title: "Save settings to Tampermonkey storage." }, "Save")
    ]);

    form.append(header, body, actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = settings;
      form.querySelectorAll("[data-setting-path]").forEach((input) => {
        const path = input.getAttribute("data-setting-path");
        const value = input.type === "checkbox" ? input.checked : input.value;
        const parts = path.split(".");
        let current = next;
        parts.slice(0, -1).forEach((part) => {
          current[part] = current[part] || {};
          current = current[part];
        });
        current[parts.at(-1)] = value;
      });
      ah.core.settings.save(next, { source: "settings-modal" });
      close();
      ah.ui.toast.show("Settings saved.", { title: "Settings saved" });
    });

    modal.append(form);
    backdrop.append(modal);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    document.body.append(backdrop);
    activateTab(modal, startingTab);
  }

  function close() {
    document.getElementById("ah-settings-modal")?.remove();
  }

  function registerMenuCommand() {
    if (registerMenuCommand.done) return;
    registerMenuCommand.done = true;
    if (typeof GM_registerMenuCommand === "function") {
      GM_registerMenuCommand("Accounting Helpers: Open Settings", open);
    }
  }

  ah.ui.settingsModal = { open, close, registerMenuCommand };
})();


/* src/sites/wave/detect.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  ah.sites.wave.detect = {
    isWave() {
      return location.hostname === "next.waveapps.com";
    },
    isTransactionsPage() {
      return this.isWave() && /transactions/i.test(location.pathname);
    }
  };
})();


/* src/sites/wave/selectors.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  ah.sites.wave.selectors = {
    modal: "[role='dialog'], [data-testid*='modal'], .modal, [class*='Modal']",
    buttons: "button, [role='button']",
    fields: "input, textarea, select, [contenteditable='true'], [role='combobox']",
    transactionRows: "[data-testid*='transaction'], tr, [role='row']"
  };
})();


/* src/sites/wave/heartbeat.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  const HEARTBEAT_INTERVAL_MS = 15000;
  const HEARTBEAT_RECENT_MS = 45000;
  const PRESENCE_REQUEST_WAIT_MS = 1200;
  const key = ah.core.constants.storageKeys.waveHeartbeat;
  const requestKey = ah.core.constants.storageKeys.wavePresenceRequest;
  let timer = null;
  let listening = false;

  function write(responseTo) {
    ah.core.storage.set(key, {
      timestamp: Date.now(),
      url: location.href,
      responseTo: typeof responseTo === "string" ? responseTo : ""
    });
  }

  function read() {
    return ah.core.storage.get(key, null);
  }

  function isRecent() {
    const heartbeat = read();
    return !!(heartbeat?.timestamp && Date.now() - Number(heartbeat.timestamp) <= HEARTBEAT_RECENT_MS);
  }

  function requestId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function hasFreshResponse(id, startedAt) {
    const heartbeat = read();
    const timestamp = Number(heartbeat?.timestamp || 0);
    return !!(timestamp >= startedAt && (heartbeat.responseTo === id || Date.now() - timestamp <= HEARTBEAT_RECENT_MS));
  }

  function requestRecent(timeout) {
    if (isRecent()) return Promise.resolve(true);
    const id = requestId();
    const startedAt = Date.now();
    if (!ah.core.storage.set(requestKey, { id, timestamp: startedAt, url: location.href })) {
      return Promise.resolve(isRecent());
    }
    return new Promise((resolve) => {
      const until = startedAt + (timeout || PRESENCE_REQUEST_WAIT_MS);
      const tick = () => {
        if (hasFreshResponse(id, startedAt)) {
          resolve(true);
          return;
        }
        if (Date.now() >= until) {
          resolve(false);
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  function listenForPresenceRequests() {
    if (listening || typeof ah.core.storage.onChange !== "function") return;
    listening = true;
    ah.core.storage.onChange(requestKey, (request, oldRequest) => {
      if (!ah.sites.wave.detect.isWave()) return;
      if (!request?.id || request.id === oldRequest?.id) return;
      write(request.id);
    });
  }

  function ensure() {
    if (!ah.sites.wave.detect.isWave()) return;
    write();
    listenForPresenceRequests();
    if (timer) return;
    timer = setInterval(write, HEARTBEAT_INTERVAL_MS);
    window.addEventListener("beforeunload", () => write());
  }

  ah.sites.wave.heartbeat = { ensure, isRecent, read, requestRecent };
})();


/* src/sites/wave/dropdowns.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  const dom = () => ah.core.dom;

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function selectWrapper(field) {
    return field?.closest?.(".wv-select") || field;
  }

  function selectedText(field) {
    const wrapper = selectWrapper(field);
    const label = wrapper?.querySelector?.(".wv-select__label");
    return dom().text(label || field);
  }

  function isSelected(field, optionText) {
    const text = normalize(selectedText(field));
    const value = normalize(field.value);
    const needle = normalize(optionText);
    return !!needle && (text.includes(needle) || value.includes(needle));
  }

  function visibleOptions(field) {
    const selector = "[role='option'], [role='menuitemradio'], .wv-select__menu__option";
    const wrapper = selectWrapper(field);
    const scoped = wrapper ? dom().visible(dom().qsa(selector, wrapper)) : [];
    return scoped.length ? scoped : dom().visible(dom().qsa(selector));
  }

  function openDropdownNodes() {
    const selector = "[role='listbox'], [role='menu'], [role='option'], [role='menuitemradio'], .wv-select__menu, .wv-select__menu__option";
    return dom().visible(dom().qsa(selector));
  }

  function findOption(field, optionText) {
    const needle = normalize(optionText);
    const options = visibleOptions(field);
    return options.find((item) => normalize(dom().text(item)) === needle) ||
      options.find((item) => normalize(dom().text(item)).includes(needle));
  }

  async function closeSafely(field) {
    const modalBefore = ah.sites.wave.transactionModal.findOpenModal();
    await new Promise((resolve) => setTimeout(resolve, 120));
    field?.blur?.();
    const active = document.activeElement;
    active?.blur?.();

    if (openDropdownNodes().length) {
      const neutral = modalBefore?.querySelector?.(".ah-ali-to-wave-modal-actions, h1, h2, h3, header") || modalBefore;
      neutral?.click?.();
      await new Promise((resolve) => setTimeout(resolve, 160));
    }

    const modalAfter = ah.sites.wave.transactionModal.findOpenModal();
    const openCount = openDropdownNodes().length;
    return {
      ok: openCount === 0 && (!modalBefore || !!modalAfter),
      modalStillOpen: !modalBefore || !!modalAfter,
      dropdownsOpenAfterClose: openCount > 0,
      openCount
    };
  }

  async function closeMenu(field) {
    return closeSafely(field);
  }

  async function chooseOption(field, optionText) {
    if (!field || !optionText) return false;
    field.focus();
    field.click();

    if (field.tagName === "SELECT") {
      const option = Array.from(field.options).find((item) =>
        item.textContent.trim().toLowerCase().includes(optionText.toLowerCase())
      );
      if (!option) return false;
      field.value = option.value;
      field.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    let option = findOption(field, optionText);
    if (!option) {
      field.click();
      await new Promise((resolve) => setTimeout(resolve, 180));
      option = findOption(field, optionText);
    }
    if (!option) {
      const active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA"].includes(active.tagName)) {
        ah.core.react.setFieldValue(active, optionText);
      } else {
        ah.core.react.setFieldValue(field, optionText);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      option = findOption(field, optionText);
    }
    if (option) {
      option.click();
      await new Promise((resolve) => setTimeout(resolve, 220));
      await closeMenu(field);
      return isSelected(field, optionText);
    }
    await closeMenu(field);
    return isSelected(field, optionText);
  }

  function getVisibleSelection(labels) {
    const field = ah.sites.wave.transactionModal.findField(labels);
    if (!field) return "";
    return field.value || field.getAttribute("aria-label") || dom().text(field);
  }

  function diagnostics() {
    const openCount = openDropdownNodes().length;
    return { anyOpen: openCount > 0, openCount };
  }

  ah.sites.wave.dropdowns = { chooseOption, getVisibleSelection, closeSafely, diagnostics };
})();


/* src/sites/wave/transactionModal.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  function findOpenModal() {
    const selector = ah.sites.wave.selectors.modal;
    const modals = ah.core.dom.visible(ah.core.dom.qsa(selector))
      .filter((modal) => !modal.closest("#ah-settings-modal") && !modal.classList.contains("ah-modal"));
    return modals.find((modal) => /(add|edit)\s+transaction/i.test(ah.core.dom.text(modal))) || null;
  }

  function findWaveSelectByLabel(root, labels) {
    const labelList = (Array.isArray(labels) ? labels : [labels]).map((label) => String(label).toLowerCase());
    const fields = ah.core.dom.visible(ah.core.dom.qsa(".wv-form-field", root));
    for (const field of fields) {
      const label = ah.core.dom.text(field.querySelector(".wv-form-field__label, label")).toLowerCase();
      if (!labelList.some((item) => label.includes(item))) continue;
      const controls = ah.core.dom.visible(ah.core.dom.qsa(".wv-select__input, .wv-select, [role='combobox']", field));
      const control = controls.find((item) => item.classList.contains("wv-select__input")) || controls[0];
      if (control) return control;
    }
    return null;
  }

  function findField(labels) {
    const root = findOpenModal() || document;
    const labelList = (Array.isArray(labels) ? labels : [labels]).map((label) => String(label).toLowerCase());
    const fields = ah.core.dom.visible(ah.core.dom.qsa(ah.sites.wave.selectors.fields, root));
    if (labelList.some((label) => label === "date")) {
      const field = fields.find((item) => item.tagName === "INPUT" && /^\d{4}-\d{2}-\d{2}$/.test(item.value || ""));
      if (field) return field;
    }
    if (labelList.some((label) => ["description", "notes"].includes(label))) {
      const field = fields.find((item) => /description/i.test(item.getAttribute("placeholder") || ""));
      if (field) return field;
    }
    if (labelList.some((label) => ["amount", "total"].includes(label))) {
      const field = fields.find((item) => /amount/i.test(item.getAttribute("aria-label") || ""));
      if (field) return field;
    }
    if (labelList.some((label) => label === "type")) {
      const field = fields.find((item) => item.tagName === "SELECT" && /direction/i.test(item.getAttribute("name") || ""));
      if (field) return field;
    }
    if (labelList.some((label) => ["account", "category", "vendor", "payee", "merchant"].includes(label))) {
      const field = findWaveSelectByLabel(root, labels);
      if (field) return field;
      return null;
    }
    return ah.core.dom.findFieldByLabel(root, labels);
  }

  function hasReadyTransactionFields() {
    const modal = findOpenModal();
    return !!(
      modal &&
      findField(["date"]) &&
      findField(["description", "notes"]) &&
      findField(["amount", "total"]) &&
      findField(["type"])
    );
  }

  function readField(labels) {
    const field = findField(labels);
    if (!field) return "";
    return field.value || field.getAttribute("aria-label") || ah.core.dom.text(field);
  }

  async function setField(labels, value, options) {
    if (value === null || value === undefined || value === "") return false;
    const field = findField(labels);
    if (!field) return false;

    if (options?.dropdown) {
      return ah.sites.wave.dropdowns.chooseOption(field, String(value));
    }
    return ah.core.react.setFieldValue(field, String(value));
  }

  function clickButton(labels) {
    const root = findOpenModal() || document;
    const labelList = Array.isArray(labels) ? labels : [labels];
    const button = labelList
      .map((label) => ah.core.dom.findByText(root, `${ah.sites.wave.selectors.buttons}, a`, label))
      .find(Boolean);
    if (!button) return false;
    button.click();
    return true;
  }

  ah.sites.wave.transactionModal = { findOpenModal, findField, readField, setField, clickButton, hasReadyTransactionFields };
})();


/* src/sites/wave/transactionList.js */
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


/* src/sites/wave/fillTransaction.js */
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


/* src/sites/aliexpress/detect.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.aliexpress = ah.sites.aliexpress || {};

  ah.sites.aliexpress.detect = {
    isAliExpress() {
      return /(^|\.)aliexpress\.com$/i.test(location.hostname);
    },
    isOrderPage() {
      return this.isAliExpress() && /\/p\/order\/index\.html/i.test(location.pathname);
    },
    isCartPage() {
      return this.isAliExpress() && /\/p\/shoppingcart\/index\.html/i.test(location.pathname);
    }
  };
})();


/* src/sites/aliexpress/selectors.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.aliexpress = ah.sites.aliexpress || {};

  ah.sites.aliexpress.selectors = {
    orderContainers: "[class*='order'], [data-order-id], [data-spm], .order-item",
    cartItems: "[class*='cart'], [class*='product'], [data-sku], [data-product-id]",
    priceText: "*"
  };
})();


/* src/sites/aliexpress/extractOrder.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.aliexpress = ah.sites.aliexpress || {};

  function directOrderId(source) {
    if (!source) return "";
    const bodyText = ah.core.dom.text(source);
    const refMatch = bodyText.match(/(?:ref\.?\s*number\s*[:#]?\s*)(\d{8,})/i);
    if (refMatch) return refMatch[1];
    const labelMatch = bodyText.match(/(?:order\s*(?:id|number|no\.?)\s*[:#]?\s*)(\d{8,})/i);
    if (labelMatch) return labelMatch[1];

    const ownAttr = source.getAttribute?.("data-order-id");
    if (ownAttr) return ownAttr;
    const fromAttr = ah.core.dom.qsa("[data-order-id]", source).map((node) => node.getAttribute("data-order-id")).find(Boolean);
    if (fromAttr) return fromAttr;

    const longNumber = bodyText.match(/\b\d{12,20}\b/);
    return longNumber ? longNumber[0] : "";
  }

  function hasRefNumber(source) {
    return /ref\.?\s*number\s*[:#]?\s*\d{8,}/i.test(ah.core.dom.text(source));
  }

  function hasOrderPayloadContext(source) {
    return !!source?.querySelector?.(".ah-send-to-wave, .ah-ae-cad-row, .ae-helper-cad-row, [data-ah-cad-total]");
  }

  function findOrderRoot(startNode) {
    const start = startNode?.nodeType === Node.ELEMENT_NODE ? startNode : startNode?.parentElement;
    const fallbackStart = start || document.querySelector(".ah-send-to-wave") || document.getElementById("ah-send-to-wave");
    for (let node = fallbackStart; node && node !== document.documentElement; node = node.parentElement) {
      if (hasRefNumber(node) && hasOrderPayloadContext(node)) return node;
    }
    for (let node = fallbackStart; node && node !== document.documentElement; node = node.parentElement) {
      if (directOrderId(node) && hasOrderPayloadContext(node)) return node;
    }

    const closestOrder = fallbackStart?.closest?.(ah.sites.aliexpress.selectors.orderContainers);
    if (directOrderId(closestOrder)) return closestOrder;

    return ah.core.dom.visible(ah.core.dom.qsa(ah.sites.aliexpress.selectors.orderContainers))
      .find((node) => directOrderId(node)) ||
      document.body;
  }

  function extractOrderId(root) {
    const source = root || findOrderRoot();
    return directOrderId(source);
  }

  function extractOrderDate(root) {
    const source = root || findOrderRoot();
    const bodyText = ah.core.dom.text(source);
    const labelMatch = bodyText.match(/(?:order\s*(?:date|time)|placed\s*on|date)\s*[:#]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i);
    return ah.core.dates.parseLooseDate(labelMatch?.[1]) || ah.core.dates.toIsoDate(new Date());
  }

  function extractUsdTotal(root) {
    const source = root || findOrderRoot();
    const text = ah.core.dom.text(source);
    const explicit = text.match(/(?:US\s*\$|USD\s*)\s*([0-9][\d,]*(?:\.\d{2})?)/i);
    if (explicit) return ah.core.money.parseMoney(explicit[1]);
    const totalLine = text.match(/(?:order\s*total|total)\s*(?:US\s*\$|\$|USD)?\s*([0-9][\d,]*(?:\.\d{2})?)/i);
    return totalLine ? ah.core.money.parseMoney(totalLine[1]) : null;
  }

  function extractCadTotal(root) {
    const source = root || findOrderRoot();
    const exactNodes = source.matches?.("[data-ah-cad-total]") ?
      [source, ...ah.core.dom.qsa("[data-ah-cad-total]", source)] :
      ah.core.dom.qsa("[data-ah-cad-total]", source);
    const existing = exactNodes
      .map((node) => node.dataset?.value || node.getAttribute?.("data-ah-cad-total") || ah.core.dom.text(node))
      .map((value) => ah.core.money.parseMoney(value))
      .find((value) => value !== null);
    if (existing !== undefined) return existing;
    const text = ah.core.dom.text(source);
    const cad = text.match(/(?:CA\s*\$|CAD\s*)\s*([0-9][\d,]*(?:\.\d{2})?)/i);
    return cad ? ah.core.money.parseMoney(cad[1]) : null;
  }

  function extractOrder() {
    const root = findOrderRoot();
    return {
      orderId: extractOrderId(root),
      orderDate: extractOrderDate(root),
      usdTotal: extractUsdTotal(root),
      cadTotal: extractCadTotal(root),
      sourceUrl: location.href,
      root
    };
  }

  ah.sites.aliexpress.extractOrder = { findOrderRoot, extractOrderId, extractOrderDate, extractUsdTotal, extractCadTotal, extractOrder };
})();


/* src/features/waveSavingsDashboard/index.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.waveSavingsDashboard = ah.features.waveSavingsDashboard || {};

  const KEY = ah.core.constants.storageKeys.savings;
  const legacyClicksKey = "tm_wave_clicks_saved";
  const legacyHistoryKey = "tm_wave_clicks_history";
  const secondsPerClick = 0.5;
  let panelClicksEl = null;

  function defaultState() {
    return { clicks: 0, history: [], startedAt: "2026-01-01" };
  }

  function state() {
    const stored = ah.core.storage.get(KEY, null);
    if (stored) return Object.assign(defaultState(), stored);

    const legacyClicks = Number(localStorage.getItem(legacyClicksKey));
    let legacyHistory = [];
    try {
      legacyHistory = JSON.parse(localStorage.getItem(legacyHistoryKey) || "[]");
    } catch (_error) {
      legacyHistory = [];
    }
    if (Number.isFinite(legacyClicks) || legacyHistory.length) {
      const migrated = {
        clicks: Number.isFinite(legacyClicks) ? legacyClicks : legacyHistory.reduce((sum, event) => sum + (Number(event.clicks) || 0), 0),
        history: legacyHistory,
        startedAt: "2026-01-01"
      };
      ah.core.storage.set(KEY, migrated);
      return migrated;
    }
    return defaultState();
  }

  function save(next) {
    ah.core.storage.set(KEY, next);
    updateSavingsUI();
  }

  function addClicks(delta, action) {
    const next = state();
    next.clicks += delta;
    next.history.push({
      timestamp: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      hour: new Date().getHours(),
      clicks: delta,
      action
    });
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    next.history = next.history.filter((event) => !event.timestamp || event.timestamp >= cutoff);
    save(next);
  }

  function formatTime(seconds) {
    if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.round(seconds % 60);
    if (minutes < 60) return `${minutes}m ${remaining}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  function updateSavingsUI() {
    if (!panelClicksEl) return;
    const data = state();
    panelClicksEl.textContent = `Saved: ${data.clicks} clicks (${formatTime(data.clicks * secondsPerClick)})`;
  }

  function getTodayClicks(history) {
    const today = new Date().toISOString().slice(0, 10);
    return history.filter((event) => event.date === today).reduce((sum, event) => sum + event.clicks, 0);
  }

  function aggregateByDay(history) {
    const byDay = {};
    history.forEach((event) => {
      byDay[event.date] = (byDay[event.date] || 0) + event.clicks;
    });
    return Object.entries(byDay).sort().slice(-14);
  }

  function openDashboard() {
    document.getElementById("ah-savings-dashboard")?.remove();
    const data = state();
    const byDay = aggregateByDay(data.history);
    const max = Math.max(1, ...byDay.map(([, clicks]) => clicks));
    const backdrop = ah.core.dom.el("div", { id: "ah-savings-dashboard", class: "ah-modal-backdrop" });
    const modal = ah.core.dom.el("div", { class: "ah-modal" });
    const stats = ah.core.dom.el("div", { class: "ah-form-grid" }, [
      ah.core.dom.el("div", {}, [`Today: ${getTodayClicks(data.history)} clicks`]),
      ah.core.dom.el("div", {}, [`Total: ${data.clicks} clicks`]),
      ah.core.dom.el("div", {}, [`Time saved: ${formatTime(data.clicks * secondsPerClick)}`])
    ]);
    const chart = ah.core.dom.el("div", { style: { display: "grid", gap: "6px", marginTop: "12px" } });
    byDay.forEach(([date, clicks]) => {
      chart.append(ah.core.dom.el("div", { style: { display: "grid", gridTemplateColumns: "92px 1fr 40px", gap: "8px", alignItems: "center" } }, [
        ah.core.dom.el("span", {}, date),
        ah.core.dom.el("span", { style: { background: "#39a16f", borderRadius: "4px", display: "block", height: "18px", width: `${Math.max(4, (clicks / max) * 100)}%` } }),
        ah.core.dom.el("strong", {}, clicks)
      ]));
    });
    modal.append(
      ah.core.dom.el("h2", {}, "Clicks Saved Dashboard"),
      stats,
      ah.core.dom.el("h3", {}, "Recent chart"),
      chart,
      ah.core.dom.el("div", { class: "ah-modal-actions" }, [
        ah.core.dom.el("button", { type: "button", class: "ah-button ah-button-secondary", onclick: () => backdrop.remove() }, "Close")
      ])
    );
    backdrop.append(modal);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) backdrop.remove();
    });
    document.body.append(backdrop);
  }

  function ensure() {
    if (!ah.sites.wave.detect.isWave()) return;
    let panel = document.getElementById("ah-wave-panel");
    if (!panel) {
      panel = ah.core.dom.el("div", { id: "ah-wave-panel" });
      Object.assign(panel.style, {
        alignItems: "center",
        background: "rgba(255,255,255,.94)",
        border: "1px solid rgba(0,0,0,.14)",
        borderRadius: "12px",
        bottom: "12px",
        boxShadow: "0 6px 20px rgba(0,0,0,.18)",
        display: "flex",
        font: "12px system-ui, sans-serif",
        gap: "12px",
        left: "50%",
        padding: "8px 12px",
        position: "fixed",
        transform: "translateX(-50%)",
        zIndex: "2147483645"
      });
      document.body.append(panel);
    }
    if (!panel.querySelector("[data-ah-wave-panel-title]")) {
      panel.append(ah.core.dom.el("strong", { "data-ah-wave-panel-title": "1" }, `Wave Helpers ${ah.core.constants.version}`));
    } else {
      panel.querySelector("[data-ah-wave-panel-title]").textContent = `Wave Helpers ${ah.core.constants.version}`;
    }
    if (!panelClicksEl) {
      panelClicksEl = ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        style: "min-height:28px;padding:5px 8px;",
        onclick: openDashboard
      });
      panel.append(panelClicksEl);
    }
    if (!panel.querySelector("[data-ah-open-settings]")) {
      panel.append(ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        "data-ah-open-settings": "1",
        style: "min-height:28px;padding:5px 8px;",
        title: "Open Accounting Helpers settings, including local Account 1 and Account 2 setup.",
        onclick: () => ah.ui.settingsModal.open()
      }, "Settings"));
    }
    updateSavingsUI();
  }

  ah.features.waveSavingsDashboard.ensure = ensure;
  ah.features.waveSavingsDashboard.addClicks = addClicks;
  ah.features.waveSavingsDashboard.state = state;
})();


/* src/features/waveTaxButtons/index.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.waveTaxButtons = ah.features.waveTaxButtons || {};

  const TAX_GST = "GST (5%)";
  const TAX_PST = "PST (7%)";
  const wrapUidAttr = "data-ah-wave-tax-wrapuid";
  const injectedAttr = "data-ah-wave-tax-injected";
  const rowClass = "ah-wave-tax-row";
  let uid = 1;
  let busy = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function textIncludes(node, needle) {
    return ah.core.dom.text(node).toLowerCase().includes(String(needle).toLowerCase());
  }

  function getOpenPopover() {
    return ah.core.dom.visible(ah.core.dom.qsa(".transaction-tax-liability__popover-content[role='dialog']")).at(-1) || null;
  }

  function getTaxRows(popover) {
    return popover ? ah.core.dom.qsa(".transaction-tax-liability__content__taxes__tax", popover) : [];
  }

  function getRowLabel(row) {
    const label = row.querySelector("button.wv-select__toggle .wv-select__label, .wv-select__label");
    return ah.core.dom.text(label);
  }

  function getSelectedTaxes(popover) {
    return getTaxRows(popover)
      .map(getRowLabel)
      .filter((tax) => tax && !/^select a sales tax/i.test(tax));
  }

  function findEmptyRowIndex(popover) {
    return getTaxRows(popover).findIndex((row) => /^select a sales tax/i.test(getRowLabel(row)));
  }

  async function openPopoverFromWrapper(wrapper) {
    const open = getOpenPopover();
    if (open) return open;
    const toggle = ah.core.dom.qsa("button.transaction-tax-liability__popover-toggle", wrapper)
      .find((button) => textIncludes(button, "Include sales tax") || textIncludes(button, "Edit"));
    if (!toggle) return null;
    toggle.click();
    try {
      return await ah.core.dom.waitFor(getOpenPopover, { timeout: 8000, interval: 50 });
    } catch (_error) {
      return null;
    }
  }

  async function waitUntilSelectedContains(taxText) {
    const want = taxText.trim().toLowerCase();
    try {
      await ah.core.dom.waitFor(() => {
        const popover = getOpenPopover();
        return popover && getSelectedTaxes(popover).some((tax) => tax.trim().toLowerCase() === want);
      }, { timeout: 8000, interval: 50 });
      return true;
    } catch (_error) {
      return false;
    }
  }

  async function setTaxInRowIndex(rowIndex, taxText) {
    const popover = getOpenPopover();
    const row = getTaxRows(popover)[rowIndex];
    if (!row) return false;
    const hiddenSelect = row.querySelector('div[data-testid="hidden-select-container"] select, select');
    if (!hiddenSelect) return false;
    const want = taxText.trim().toLowerCase();
    const option = Array.from(hiddenSelect.options).find((item) =>
      ah.core.dom.text(item).trim().toLowerCase() === want
    ) || Array.from(hiddenSelect.options).find((item) =>
      ah.core.dom.text(item).trim().toLowerCase().includes(want)
    );
    if (!option) return false;
    if (hiddenSelect.value !== option.value) {
      hiddenSelect.value = option.value;
      hiddenSelect.dispatchEvent(new Event("input", { bubbles: true }));
      hiddenSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return waitUntilSelectedContains(taxText);
  }

  async function ensureTaxPresent(wrapper, taxText) {
    let popover = await openPopoverFromWrapper(wrapper);
    if (!popover) return false;
    const want = taxText.trim().toLowerCase();
    if (getSelectedTaxes(popover).some((tax) => tax.trim().toLowerCase() === want)) return true;

    if (getSelectedTaxes(popover).length === 0) return setTaxInRowIndex(0, taxText);

    let emptyIndex = findEmptyRowIndex(popover);
    if (emptyIndex >= 0) return setTaxInRowIndex(emptyIndex, taxText);

    const applyAnother = ah.core.dom.qsa("button, [role='button']", popover)
      .find((button) => textIncludes(button, "Apply another tax"));
    if (applyAnother) {
      applyAnother.click();
      await sleep(900);
      popover = getOpenPopover();
      emptyIndex = findEmptyRowIndex(popover);
      return setTaxInRowIndex(emptyIndex >= 0 ? emptyIndex : getTaxRows(popover).length - 1, taxText);
    }

    return setTaxInRowIndex(0, taxText);
  }

  function clickUpdateIfEnabled() {
    if (!ah.core.settings.get("wave.autoUpdateTaxPopover", false)) return;
    const popover = getOpenPopover();
    const update = popover?.querySelector('[data-testid="popover-actions"] button.wv-button--primary') ||
      ah.core.dom.findByText(popover || document, "button, [role='button']", "Update");
    update?.click?.();
  }

  function findWrapperForButton(button) {
    const id = button.dataset.wrapuid;
    if (!id) return null;
    return document.querySelector(`[${wrapUidAttr}="${CSS.escape(id)}"]`);
  }

  async function applyTax(event, taxText) {
    if (busy) {
      ah.ui.toast.show("Wave helper is busy.", { tone: "warn" });
      return;
    }
    busy = true;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const wrapper = findWrapperForButton(button);
      const ok = wrapper && await ensureTaxPresent(wrapper, taxText);
      if (!ok) {
        ah.ui.toast.show(`Failed to apply ${taxText}.`, { tone: "warn" });
        return;
      }
      ah.features.waveSavingsDashboard.addClicks(3, taxText === TAX_GST ? "GST" : "PST");
      ah.ui.toast.show(`Applied ${taxText}.`);
      await sleep(120);
      clickUpdateIfEnabled();
    } catch (error) {
      ah.core.logger.error("Tax button failed", String(error));
      ah.ui.toast.show(`Error applying ${taxText}.`, { tone: "error" });
    } finally {
      button.disabled = false;
      busy = false;
    }
  }

  async function applyBoth(event) {
    if (busy) {
      ah.ui.toast.show("Wave helper is busy.", { tone: "warn" });
      return;
    }
    busy = true;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const wrapper = findWrapperForButton(button);
      if (!wrapper) throw new Error("wrapper missing");
      const gst = await ensureTaxPresent(wrapper, TAX_GST);
      await sleep(350);
      const pst = await ensureTaxPresent(wrapper, TAX_PST);
      if (!gst || !pst) {
        ah.ui.toast.show("Failed to apply GST + PST.", { tone: "warn" });
        return;
      }
      ah.features.waveSavingsDashboard.addClicks(6, "COMBO");
      ah.ui.toast.show("Applied GST + PST.");
      await sleep(120);
      clickUpdateIfEnabled();
    } catch (error) {
      ah.core.logger.error("Tax combo failed", String(error));
      ah.ui.toast.show("Error applying GST + PST.", { tone: "error" });
    } finally {
      button.disabled = false;
      busy = false;
    }
  }

  function makeButton(label, onClick, tone) {
    return ah.core.dom.el("button", {
      type: "button",
      class: `ah-button ${tone === "danger" ? "" : "ah-button-secondary"}`,
      style: tone === "danger" ? "background:#b43232;border-color:#922929;" : "",
      onclick: (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick(event);
      }
    }, label);
  }

  function ensureWrapperUid(wrapper) {
    let id = wrapper.getAttribute(wrapUidAttr);
    if (!id) {
      id = String(uid++);
      wrapper.setAttribute(wrapUidAttr, id);
    }
    return id;
  }

  function injectButtons(wrapper) {
    const id = ensureWrapperUid(wrapper);
    if (document.querySelector(`.${rowClass}[data-wrapuid="${CSS.escape(id)}"]`)) return;
    const row = ah.core.dom.el("div", { class: rowClass, "data-wrapuid": id, style: "display:block;width:100%;margin:8px 0 16px;" });
    const inner = ah.core.dom.el("span", { class: "ah-pill-row" });
    const gst = makeButton("Apply GST", (event) => applyTax(event, TAX_GST));
    const pst = makeButton("Apply PST", (event) => applyTax(event, TAX_PST));
    const both = makeButton("Apply GST + PST", applyBoth, "danger");
    [gst, pst, both].forEach((button) => { button.dataset.wrapuid = id; inner.append(button); });
    row.append(inner);
    wrapper.insertAdjacentElement("afterend", row);
  }

  function ensurePanelToggle() {
    const panel = document.getElementById("ah-wave-panel");
    if (!panel || panel.querySelector("[data-ah-auto-update]")) return;
    const checkbox = ah.core.dom.el("input", { type: "checkbox", "data-ah-auto-update": "1" });
    checkbox.checked = ah.core.settings.get("wave.autoUpdateTaxPopover", false);
    checkbox.addEventListener("change", () => {
      ah.core.settings.set("wave.autoUpdateTaxPopover", checkbox.checked, { source: "settings-modal" });
      ah.ui.toast.show(`Auto Update ${checkbox.checked ? "ON" : "OFF"}.`);
    });
    panel.append(ah.core.dom.el("label", { class: "ah-check", style: "white-space:nowrap;" }, [checkbox, "Auto Update"]));
  }

  function ensure() {
    if (!ah.sites.wave.detect.isWave()) return;
    ah.features.waveSavingsDashboard.ensure();
    ensurePanelToggle();
    const wrappers = ah.core.dom.qsa(`.anchor-transaction__line-item--singleline__btn-wrapper:not([${injectedAttr}])`);
    wrappers.forEach((wrapper) => {
      wrapper.setAttribute(injectedAttr, "1");
      const hasTaxToggle = ah.core.dom.qsa("button.transaction-tax-liability__popover-toggle", wrapper)
        .some((button) => textIncludes(button, "Include sales tax") || textIncludes(button, "Edit"));
      if (hasTaxToggle) injectButtons(wrapper);
    });
  }

  ah.features.waveTaxButtons.ensure = ensure;
})();


/* src/features/waveAccountSwitcher/index.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.waveAccountSwitcher = ah.features.waveAccountSwitcher || {};

  const injectedAttr = "data-ah-wave-account-switcher";
  const accountDropdownSelector = ".transactions-list-v2__anchor-transaction__edit__field--account__select";
  let busy = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function findAccountDropdown(root) {
    const scope = root || document;
    return ah.core.dom.visible(ah.core.dom.qsa(`${accountDropdownSelector}, .wv-select.wv-select--fluid, [role='combobox']`, scope))
      .find(isAccountDropdown) ||
      ah.core.dom.findFieldByLabel(scope, ["account", "payment account"]);
  }

  function hasAccountLabel(text) {
    return /^(account|payment account)\b/i.test(String(text || "").trim());
  }

  function isAccountDropdown(dropdown) {
    if (!dropdown) return false;
    if (dropdown.matches(accountDropdownSelector)) return true;
    const aria = dropdown.getAttribute("aria-label") || dropdown.getAttribute("name") || dropdown.getAttribute("data-testid");
    if (hasAccountLabel(aria)) return true;

    let node = dropdown;
    for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
      const label = node.querySelector?.("label");
      if (label && !dropdown.contains(label) && hasAccountLabel(ah.core.dom.text(label))) return true;

      const siblings = Array.from(node.parentElement?.children || []);
      const index = siblings.indexOf(node);
      const previousText = siblings.slice(0, Math.max(0, index)).reverse()
        .map((item) => ah.core.dom.text(item))
        .find(Boolean);
      if (hasAccountLabel(previousText)) return true;

      const fieldText = ah.core.dom.text(node);
      if (hasAccountLabel(fieldText) && fieldText.length < 120) return true;
    }
    return false;
  }

  function getCurrentAccount(dropdown) {
    if (!dropdown) return "";
    return ah.core.dom.text(dropdown.querySelector(".wv-select__label")) || dropdown.value || ah.core.dom.text(dropdown);
  }

  function getOpenMenu() {
    return ah.core.dom.visible(ah.core.dom.qsa(".wv-select__menu, [role='listbox']")).at(-1) || null;
  }

  async function openDropdown(dropdown) {
    const already = getOpenMenu();
    if (already) return already;
    const target = dropdown.querySelector(".wv-select__toggle, .wv-select__input") || dropdown;
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    target.click();
    try {
      return await ah.core.dom.waitFor(getOpenMenu, { timeout: 5000, interval: 100 });
    } catch (_error) {
      return null;
    }
  }

  async function selectOption(menu, accountName) {
    const want = String(accountName || "").trim().toLowerCase();
    if (!want || !menu) return false;
    const search = menu.querySelector(".wv-input, input");
    if (search) {
      ah.core.react.setFieldValue(search, accountName);
      await sleep(150);
    }
    const options = ah.core.dom.qsa(".wv-select__menu__option, [role='option'], li, button", menu);
    const option = options.find((item) => ah.core.dom.text(item).trim().toLowerCase() === want) ||
      options.find((item) => {
        const text = ah.core.dom.text(item).trim().toLowerCase();
        return text.includes(want) || want.includes(text);
      });
    if (!option) return false;
    option.click();
    option.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await sleep(300);
    return true;
  }

  async function switchDirect(dropdown, targetAccount) {
    const menu = await openDropdown(dropdown);
    return selectOption(menu, targetAccount);
  }

  function configuredAccounts() {
    return [
      ah.core.settings.get("wave.accounts.amex", ""),
      ah.core.settings.get("wave.accounts.creditCard", "")
    ].filter(Boolean);
  }

  function chooseTarget(current) {
    const accounts = configuredAccounts();
    if (accounts.length < 2) return "";
    const currentLower = current.toLowerCase();
    const currentIndex = accounts.findIndex((account) => {
      const value = account.toLowerCase();
      return currentLower === value || currentLower.includes(value) || value.includes(currentLower);
    });
    return currentIndex === 0 ? accounts[1] : accounts[0];
  }

  async function onSwitch(event) {
    if (busy) return;
    busy = true;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const dropdown = findAccountDropdown(button.closest(".anchor-transaction__line-item--singleline, [role='dialog']") || document);
      const current = getCurrentAccount(dropdown);
      const target = chooseTarget(current);
      if (!dropdown || !target) {
        ah.ui.toast.show("Configure Account 1 and Account 2 in settings.", { tone: "warn" });
        return;
      }
      const ok = await switchDirect(dropdown, target);
      if (ok) {
        ah.features.waveSavingsDashboard.addClicks(3, "ACCOUNT_SWITCH");
        ah.ui.toast.show("Account switched.");
      } else {
        ah.ui.toast.show("Account option not found.", { tone: "warn" });
      }
    } finally {
      button.disabled = false;
      busy = false;
    }
  }

  function injectNear(dropdown) {
    const target = dropdown.closest(".anchor-transaction__line-item--singleline") || dropdown.parentElement;
    if (!target || target.hasAttribute(injectedAttr)) return;
    const row = ah.core.dom.el("div", { class: "ah-pill-row", style: "margin:8px 0 12px;" });
    if (configuredAccounts().length >= 2) {
      row.append(ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        title: "Switch between Account 1 and Account 2 saved in local Tampermonkey settings.",
        onclick: onSwitch
      }, "Switch account"));
    }
    if (!row.childElementCount) return;
    target.setAttribute(injectedAttr, "1");
    target.insertAdjacentElement("afterend", row);
  }

  function ensure() {
    if (!ah.sites.wave.detect.isWave()) return;
    const dropdowns = ah.core.dom.visible(ah.core.dom.qsa(`${accountDropdownSelector}, .wv-select.wv-select--fluid, [role='combobox']`));
    dropdowns.filter((dropdown) => isAccountDropdown(dropdown) && getCurrentAccount(dropdown)).forEach(injectNear);
  }

  ah.features.waveAccountSwitcher.ensure = ensure;
})();


/* src/features/waveReviewedSave/index.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.waveReviewedSave = ah.features.waveReviewedSave || {};

  let installed = false;
  let inFlight = false;

  function textIncludes(node, needle) {
    return ah.core.dom.text(node).toLowerCase().includes(String(needle).toLowerCase());
  }

  function findMarkReviewedButton(target) {
    const button = target?.closest?.("button");
    if (!button) return null;
    if (button.classList.contains("transactions-list-v2__details__mark-reviewed")) return button;
    return textIncludes(button, "Mark as reviewed") ? button : null;
  }

  function findSaveButtonNear(markButton) {
    const modal = markButton.closest(".wv-modal, [role='dialog']");
    const scope = modal || document;
    const footer = ah.core.dom.visible(ah.core.dom.qsa(".wv-modal__footer, footer, [data-testid*='footer']", scope))[0] || scope;
    return footer.querySelector('button[aria-label="Save transaction"]') ||
      ah.core.dom.findByText(footer, "button.wv-button--primary, button", "Save");
  }

  async function autoSave(markButton) {
    if (!ah.core.settings.get("wave.markReviewedAutoSave", false)) return;
    if (inFlight) return;
    inFlight = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 220));
      const saveButton = await ah.core.dom.waitFor(() => {
        const button = findSaveButtonNear(markButton);
        return button && !button.disabled && button.getAttribute("aria-disabled") !== "true" ? button : null;
      }, { timeout: 4000, interval: 80 });
      saveButton.click();
      ah.features.waveSavingsDashboard.addClicks(1, "MARK_REVIEWED");
      ah.ui.toast.show("Saved after mark reviewed.");
    } catch (_error) {
      ah.core.logger.warn("Save button did not become available after mark reviewed");
    } finally {
      setTimeout(() => { inFlight = false; }, 300);
    }
  }

  function ensurePanelToggle() {
    const panel = document.getElementById("ah-wave-panel");
    if (!panel || panel.querySelector("[data-ah-mark-reviewed-save]")) return;
    const checkbox = ah.core.dom.el("input", { type: "checkbox", "data-ah-mark-reviewed-save": "1" });
    checkbox.checked = ah.core.settings.get("wave.markReviewedAutoSave", false);
    checkbox.addEventListener("change", () => {
      ah.core.settings.set("wave.markReviewedAutoSave", checkbox.checked, { source: "settings-modal" });
      ah.ui.toast.show(`Save after Mark as reviewed ${checkbox.checked ? "ON" : "OFF"}.`);
    });
    panel.append(ah.core.dom.el("label", {
      class: "ah-check",
      style: "white-space:nowrap;",
      title: "After you click Mark as reviewed, automatically click Save when enabled."
    }, [checkbox, "Save after reviewed"]));
  }

  function ensure() {
    if (!ah.sites.wave.detect.isWave()) return;
    ah.features.waveSavingsDashboard.ensure();
    ensurePanelToggle();
    if (installed) return;
    installed = true;
    document.addEventListener("click", (event) => {
      const markButton = findMarkReviewedButton(event.target);
      if (markButton) autoSave(markButton);
    }, true);
  }

  ah.features.waveReviewedSave.ensure = ensure;
})();


/* src/features/aliexpressCadCopy/index.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.aliexpressCadCopy = ah.features.aliexpressCadCopy || {};

  const rateUrl = "https://open.er-api.com/v6/latest/USD";
  const rateRefreshMs = 10 * 60 * 1000;
  const containerSelector = ".order-item-content-opt-price";
  const totalSelector = '[data-pl="order_item_content_price_total"]';
  const rowClass = "ah-ae-cad-row";
  let cadRate = null;
  let lastRateFetch = 0;
  let scanScheduled = false;

  function copyText(text) {
    if (typeof GM_setClipboard === "function") {
      GM_setClipboard(text);
      return;
    }
    navigator.clipboard?.writeText?.(text).catch(() => {});
  }

  function fetchJson(url) {
    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          onload: (response) => {
            try {
              resolve(JSON.parse(response.responseText));
            } catch (error) {
              reject(error);
            }
          },
          onerror: reject
        });
      });
    }
    return fetch(url, { credentials: "omit" }).then((response) => response.json());
  }

  async function ensureRate() {
    const now = Date.now();
    if (cadRate && now - lastRateFetch < rateRefreshMs) return cadRate;
    const data = await fetchJson(rateUrl);
    if (!data?.rates?.CAD) throw new Error("CAD rate missing");
    cadRate = data.rates.CAD;
    lastRateFetch = now;
    return cadRate;
  }

  function usdText(totalNode) {
    const priceNode = totalNode.querySelector("div");
    return ah.core.dom.text(priceNode || totalNode);
  }

  function handleCopy(button, text) {
    copyText(text);
    const original = button.textContent;
    button.textContent = "Copied";
    button.disabled = true;
    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 1200);
  }

  async function updateCadRow(container, totalNode) {
    let rate;
    try {
      rate = await ensureRate();
    } catch (error) {
      ah.core.logger.warn("FX rate unavailable", String(error));
      return;
    }
    const usdValue = ah.core.money.parseMoney(usdText(totalNode));
    if (usdValue === null) return;
    const cadAmount = ah.core.money.roundCents(usdValue * rate);
    const cadDisplay = ah.core.money.formatCurrency(cadAmount, "CAD").replace("$", "CA $");
    const host = container.closest(".order-item-content-opt") || container.parentElement;
    if (!host) return;

    let row = host.querySelector(`:scope > .${rowClass}`);
    if (!row) {
      row = ah.core.dom.el("div", { class: `${rowClass} ah-ae-row` });
      const badge = ah.core.dom.el("span", { class: "ah-ae-total" }, "CAD Total");
      const value = ah.core.dom.el("span", { "data-ah-cad-total": "" });
      const copy = ah.core.dom.el("button", { type: "button", class: "ah-button ah-button-secondary" }, "Copy");
      copy.addEventListener("click", () => handleCopy(copy, value.dataset.value || ""));
      row.append(badge, value, copy);
      host.insertBefore(row, host.querySelector(".order-item-btns-wrap") || null);
    }

    const value = row.querySelector("[data-ah-cad-total]");
    value.textContent = cadDisplay;
    value.dataset.value = cadAmount.toFixed(2);
    row.setAttribute("data-ah-cad-total", cadAmount.toFixed(2));
  }

  function enhanceTotal(container) {
    const totalNode = container.querySelector(totalSelector);
    if (totalNode) updateCadRow(container, totalNode);
  }

  function scan() {
    ah.core.dom.qsa(containerSelector).forEach(enhanceTotal);
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      scan();
    });
  }

  function ensure() {
    if (!ah.sites.aliexpress.detect.isOrderPage()) return;
    scheduleScan();
  }

  ah.features.aliexpressCadCopy.ensure = ensure;
  ah.features.aliexpressCadCopy.scheduleScan = scheduleScan;
  ah.features.aliexpressCadCopy.ensureRate = ensureRate;
})();


/* src/features/aliexpressCartPerUnit/index.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.aliexpressCartPerUnit = ah.features.aliexpressCartPerUnit || {};

  const summaryItemSelector = ".cart-summary-item-wrapStyle";
  const summaryLabelSelector = ".cart-summary-item-wrapStyle-label";
  const summaryContentSelector = ".cart-summary-item-wrapStyle-content";
  const chosenItemSelector = ".cart-summary-chosenCartLines-item";
  const productSelector = ".cart-product";
  const productImageSelector = ".cart-product-img";
  const quantityInputSelector = '.comet-v2-input-number-input[aria-label="number"]';
  const rowClass = "ah-ae-per-unit-row";
  let updateTimer = null;
  let installed = false;

  function parseCurrencyAmount(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    const match = normalized.match(/(-?[\d,.]+)/);
    if (!match) return null;
    const amount = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(amount)) return null;
    return { amount, currency: normalized.replace(match[1], "").replace(/\s+/g, " ").trim() };
  }

  function backgroundImageUrl(element) {
    const style = element?.style?.backgroundImage || "";
    const match = style.match(/url\(["']?(.*?)["']?\)/i);
    return match ? match[1] : null;
  }

  function findEstimatedTotalRow() {
    return ah.core.dom.qsa(summaryLabelSelector).find((label) =>
      ah.core.dom.text(label).toLowerCase() === "estimated total"
    )?.closest(summaryItemSelector) || null;
  }

  function ensurePerUnitRow() {
    const estimatedRow = findEstimatedTotalRow();
    if (!estimatedRow) return null;
    let row = estimatedRow.nextElementSibling;
    if (!row || !row.classList.contains(rowClass)) {
      row = ah.core.dom.el("div", { class: rowClass, style: "display:flex;justify-content:space-between;align-items:center;margin-top:8px;width:100%;box-sizing:border-box;padding:8px 12px;border-radius:8px;border:1px dashed #9eb3d8;background:#eef5f7;font:13px system-ui,sans-serif;color:#152d34;gap:12px;" }, [
        ah.core.dom.el("strong", {}, "Per-unit cost"),
        ah.core.dom.el("span", { class: "ah-ae-per-unit-value" }),
        ah.core.dom.el("span", { class: "ah-ae-per-unit-message" })
      ]);
      estimatedRow.insertAdjacentElement("afterend", row);
    }
    ah.core.dom.qsa(`.${rowClass}`).forEach((other) => {
      if (other !== row) other.remove();
    });
    if (estimatedRow.nextElementSibling !== row) estimatedRow.insertAdjacentElement("afterend", row);
    return row;
  }

  function resolveSelectedProduct(selectedItem) {
    const targetImageUrl = backgroundImageUrl(selectedItem?.querySelector(".cart-summary-chosenCartLines-item-img"));
    if (!targetImageUrl) return null;
    return ah.core.dom.qsa(productSelector).find((product) =>
      backgroundImageUrl(product.querySelector(productImageSelector)) === targetImageUrl
    ) || null;
  }

  function updatePerUnitRow() {
    document.querySelectorAll(".ae-helper-cart-cad-total").forEach((node) => node.remove());
    const row = ensurePerUnitRow();
    if (!row) return;
    const valueNode = row.querySelector(".ah-ae-per-unit-value");
    const messageNode = row.querySelector(".ah-ae-per-unit-message");
    const estimatedContent = findEstimatedTotalRow()?.querySelector(summaryContentSelector);
    const parsed = parseCurrencyAmount(ah.core.dom.text(estimatedContent));
    if (!parsed) {
      row.hidden = true;
      return;
    }

    const selectedItems = ah.core.dom.qsa(chosenItemSelector);
    if (selectedItems.length !== 1) {
      valueNode.textContent = "";
      messageNode.textContent = "Select exactly one item to calculate.";
      row.hidden = false;
      return;
    }

    const product = resolveSelectedProduct(selectedItems[0]);
    const quantity = Number(product?.querySelector(quantityInputSelector)?.value?.replace(/,/g, ""));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      row.hidden = true;
      return;
    }

    valueNode.textContent = `${parsed.currency || ""}${(parsed.amount / quantity).toFixed(2)}`;
    messageNode.textContent = "";
    row.hidden = false;
  }

  function scheduleUpdate() {
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      updateTimer = null;
      updatePerUnitRow();
    }, 150);
  }

  function ensure() {
    if (!ah.sites.aliexpress.detect.isCartPage()) return;
    scheduleUpdate();
    if (installed) return;
    installed = true;
    document.addEventListener("input", (event) => {
      if (event.target?.matches?.(quantityInputSelector)) scheduleUpdate();
    }, true);
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.(productSelector)) scheduleUpdate();
    }, true);
  }

  ah.features.aliexpressCartPerUnit.ensure = ensure;
})();


/* src/features/aliToWave/payload.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.aliToWave = ah.features.aliToWave || {};

  const ALI_TO_WAVE_PAYLOAD_VERSION = 1;

  function createAliToWavePayload({ orderId, orderDate, cadAmount, sourceUrl }) {
    return {
      version: ALI_TO_WAVE_PAYLOAD_VERSION,
      source: "aliexpress",
      target: "wave",
      orderId: String(orderId || ""),
      orderDate,
      amount: {
        value: Number(cadAmount).toFixed(2),
        currency: "CAD"
      },
      wave: {
        description: `Ali | ${orderId}`,
        vendor: null,
        account: null,
        category: null,
        type: null
      },
      sourceUrl,
      createdAt: Date.now()
    };
  }

  function isValidPayload(payload) {
    const amount = Number(payload?.amount?.value);
    return !!(
      payload &&
      payload.version === ALI_TO_WAVE_PAYLOAD_VERSION &&
      payload.source === "aliexpress" &&
      payload.target === "wave" &&
      payload.orderId &&
      Number.isFinite(amount)
    );
  }

  ah.features.aliToWave.payload = { ALI_TO_WAVE_PAYLOAD_VERSION, createAliToWavePayload, isValidPayload };
})();


/* src/features/aliToWave/duplicateGuard.js */
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


/* src/features/aliToWave/stageFromAliExpress.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.aliToWave = ah.features.aliToWave || {};

  const pendingKey = ah.core.constants.storageKeys.aliPendingPayload;

  function setButtonState(button, text, tone) {
    button.textContent = text;
    button.disabled = tone === "disabled";
    button.dataset.state = tone || "";
  }

  function pendingPayload() {
    return ah.core.storage.get(pendingKey, null);
  }

  function clearPendingPayload() {
    ah.core.storage.remove(pendingKey);
    window.dispatchEvent(new CustomEvent(ah.core.constants.events.pendingPayloadChanged));
  }

  function savePendingPayload(payload) {
    const ok = ah.core.storage.set(pendingKey, payload);
    window.dispatchEvent(new CustomEvent(ah.core.constants.events.pendingPayloadChanged, { detail: payload }));
    return ok;
  }

  function findStageButtons() {
    return ah.core.dom.qsa(".ah-send-to-wave");
  }

  function orderFromButton(button) {
    const row = button.closest(".ah-ae-cad-row, .ae-helper-cad-row, [data-ah-cad-total]") || button;
    const root = ah.sites.aliexpress.extractOrder.findOrderRoot(row);
    return {
      orderId: ah.sites.aliexpress.extractOrder.extractOrderId(root),
      orderDate: ah.sites.aliexpress.extractOrder.extractOrderDate(root),
      cadTotal: ah.sites.aliexpress.extractOrder.extractCadTotal(row) ?? ah.sites.aliexpress.extractOrder.extractCadTotal(root),
      sourceUrl: location.href,
      root
    };
  }

  function refreshStageButtons() {
    const pending = pendingPayload();
    findStageButtons().forEach((button) => {
      const order = orderFromButton(button);
      if (order.orderId && ah.features.aliToWave.duplicateGuard.isImported(order.orderId) && !ah.core.settings.get("aliToWave.allowReimport", false)) {
        setButtonState(button, "Already imported", "disabled");
        return;
      }
      if (pending?.orderId && order.orderId === pending.orderId) {
        setButtonState(button, "Staged for Wave", "disabled");
        return;
      }
      setButtonState(button, "Stage for Wave", "");
    });
  }

  async function isWaveOpen() {
    if (typeof ah.sites.wave?.heartbeat?.requestRecent === "function") {
      return ah.sites.wave.heartbeat.requestRecent();
    }
    return !!ah.sites.wave?.heartbeat?.isRecent?.();
  }

  function openWaveTransactions() {
    if (typeof GM_openInTab !== "function") return false;
    GM_openInTab(ah.core.constants.waveTransactionsUrl, { active: true, insert: true });
    return true;
  }

  async function stageForWave(button) {
    const order = orderFromButton(button);
    if (!order.orderId) {
      setButtonState(button, "Could not find order ID on this order card", "warn");
      return;
    }
    if (ah.features.aliToWave.duplicateGuard.isImported(order.orderId) && !ah.core.settings.get("aliToWave.allowReimport", false)) {
      setButtonState(button, "Already imported", "disabled");
      return;
    }
    if (order.cadTotal === null || order.cadTotal === undefined) {
      setButtonState(button, "Failed: missing CAD total", "warn");
      return;
    }

    const payload = ah.features.aliToWave.payload.createAliToWavePayload({
      orderId: order.orderId,
      orderDate: order.orderDate,
      cadAmount: order.cadTotal,
      sourceUrl: order.sourceUrl
    });

    const previous = pendingPayload();
    if (!savePendingPayload(payload)) {
      setButtonState(button, "Stage failed", "warn");
      ah.ui.toast.show("Could not stage this order for Wave.", { tone: "error" });
      return;
    }
    refreshStageButtons();

    if (await isWaveOpen()) {
      const autoCreate = ah.core.settings.get("aliToWave.autoCreateWithdrawal", false);
      const action = autoCreate ?
        "Wave will create and fill a withdrawal unless a transaction modal is already open." :
        "Switch to Wave to create or fill a transaction.";
      const message = previous?.orderId && previous.orderId !== payload.orderId ?
        `Replaced the previously staged AliExpress order. ${action}` :
        `Order staged for Wave. ${action}`;
      ah.ui.toast.show(message);
      return;
    }

    ah.ui.toast.show("Order staged for Wave. Opening Wave transactions...");
    openWaveTransactions();
  }

  function injectButton(row) {
    if (!row || row.querySelector(".ah-send-to-wave")) return;
    const value = ah.core.money.parseMoney(row.getAttribute("data-ah-cad-total") || row.querySelector("[data-ah-cad-total]")?.dataset.value);
    if (value === null) return;
    const button = ah.core.dom.el("button", {
      type: "button",
      class: "ah-button ah-send-to-wave",
      title: "Stage this AliExpress order in Tampermonkey storage so it can fill an open Wave transaction modal.",
      onclick: () => stageForWave(button)
    }, "Stage for Wave");
    row.append(button);

    refreshStageButtons();
  }

  function ensureAliExpressSendButton() {
    if (!ah.sites.aliexpress.detect.isOrderPage()) return;
    document.querySelectorAll(".ah-ae-cad-row, .ae-helper-cad-row").forEach(injectButton);
    refreshStageButtons();
  }

  ah.features.aliToWave.stageFromAliExpress = { pendingPayload, clearPendingPayload, savePendingPayload };
  ah.features.aliToWave.ensureAliExpressSendButton = ensureAliExpressSendButton;
})();


/* src/features/aliToWave/importIntoWave.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.aliToWave = ah.features.aliToWave || {};

  const pendingKey = ah.core.constants.storageKeys.aliPendingPayload;
  const modalActionsClass = "ah-ali-to-wave-modal-actions";
  const bannerId = "ah-ali-to-wave-banner";
  let autoFillInFlight = false;
  let autoFillAttemptKey = "";
  let createFillInFlight = false;
  let autoCreateAttemptKey = "";

  function pendingPayload() {
    const payload = ah.core.storage.get(pendingKey, null);
    return ah.features.aliToWave.payload.isValidPayload(payload) ? payload : null;
  }

  function clearPendingPayload() {
    ah.core.storage.remove(pendingKey);
    ah.ui.floatingPanel.remove(bannerId);
    window.dispatchEvent(new CustomEvent(ah.core.constants.events.pendingPayloadChanged));
  }

  function recordLastFillResult(result) {
    const next = Object.assign({ recordedAt: new Date().toISOString() }, result || {});
    ah.features.aliToWave.lastFillResult = next;
    return next;
  }

  async function fillOpenTransaction(payload) {
    const result = await ah.sites.wave.fillTransaction.fillFromAliPayload(payload);
    let duplicateGuardMarkedImported = false;
    let pendingPayloadCleared = false;
    if (result.complete) {
      duplicateGuardMarkedImported = ah.features.aliToWave.duplicateGuard.markImported(payload);
      clearPendingPayload();
      pendingPayloadCleared = true;
    }
    const detailedResult = recordLastFillResult(Object.assign({}, result, {
      duplicateGuardMarkedImported,
      pendingPayloadCleared
    }));
    ah.ui.toast.show(detailedResult.message, { tone: detailedResult.complete ? "success" : "warn" });
    return detailedResult;
  }

  function payloadKey(payload) {
    return [
      payload?.orderId || "",
      payload?.amount?.value || "",
      payload?.amount?.currency || ""
    ].join("|");
  }

  async function createWithdrawalAndFill(payload, options) {
    if (createFillInFlight) {
      return recordLastFillResult({ ok: false, complete: false, message: "Wave helper is already creating a withdrawal." });
    }
    if (ah.sites.wave.transactionModal.findOpenModal()) {
      const result = recordLastFillResult({ ok: false, complete: false, message: "A Wave transaction modal is already open. Review it or close it before creating a new withdrawal." });
      if (options?.toast !== false) ah.ui.toast.show(result.message, { tone: "warn" });
      return result;
    }

    createFillInFlight = true;
    try {
      const opened = await ah.sites.wave.transactionList.openAddWithdrawalModal();
      if (!opened.ok) {
        if (options?.toast !== false) ah.ui.toast.show(opened.message, { tone: "warn" });
        return recordLastFillResult(Object.assign({ complete: false }, opened));
      }
      autoFillAttemptKey = payloadKey(payload);
      const result = await fillOpenTransaction(payload);
      recordCreateFillSavings(opened, result);
      return result;
    } finally {
      createFillInFlight = false;
    }
  }

  function recordCreateFillSavings(opened, result) {
    if (!result?.complete) return;
    const steps = [...(opened.clicksSavedSteps || []), "Fill staged AliExpress order"];
    if (!steps.length) return;
    ah.features.waveSavingsDashboard?.addClicks?.(
      steps.length,
      `AliExpress to Wave: ${steps.join(", ")}`
    );
    ah.ui.toast.show(`Saved ${steps.length} clicks: ${steps.join(", ")}.`, { title: "Clicks saved" });
  }

  function renderBanner(payload) {
    const amount = ah.core.money.formatCurrency(payload.amount.value, payload.amount.currency);
    const content = ah.core.dom.el("div", {}, [
      ah.core.dom.el("strong", {}, `Pending AliExpress order: ${payload.orderId}`),
      ah.core.dom.el("div", { style: "margin-bottom:8px;" }, `CAD amount: ${amount}`),
      ah.core.dom.el("div", { class: "ah-help" }, "One order is staged at a time. Staging another AliExpress order replaces this one."),
      ah.core.dom.el("div", { class: "ah-pill-row" }, [
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button",
          title: "Open Wave's Add withdrawal modal, then fill it with this staged AliExpress order.",
          onclick: () => createWithdrawalAndFill(payload)
        }, "Create withdrawal + fill"),
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button ah-button-secondary",
          title: "Fill the currently open Wave edit transaction modal with this staged AliExpress order.",
          onclick: () => fillOpenTransaction(payload)
        }, "Fill this transaction"),
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button ah-button-secondary",
          title: "Remove this staged AliExpress order without marking it imported.",
          onclick: clearPendingPayload
        }, "Clear")
      ])
    ]);
    return content;
  }

  function removeModalActions() {
    document.querySelectorAll(`.${modalActionsClass}`).forEach((node) => node.remove());
  }

  function renderModalActions(payload) {
    const amount = ah.core.money.formatCurrency(payload.amount.value, payload.amount.currency);
    return ah.core.dom.el("div", {
      class: modalActionsClass,
      "data-ah-order-id": payload.orderId,
      "data-ah-amount": payload.amount.value,
      "data-ah-currency": payload.amount.currency
    }, [
      ah.core.dom.el("strong", {}, `AliExpress order ${payload.orderId}`),
      ah.core.dom.el("span", {}, amount),
      ah.core.dom.el("span", { class: "ah-help" }, "Latest staged order"),
      ah.core.dom.el("button", {
        type: "button",
        class: "ah-button",
        title: "Fill this Wave transaction with the staged AliExpress order.",
        onclick: () => fillOpenTransaction(payload)
      }, "Fill AliExpress order"),
      ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        title: "Remove this staged AliExpress order without marking it imported.",
        onclick: clearPendingPayload
      }, "Clear")
    ]);
  }

  function isSamePayload(container, payload) {
    return container?.dataset?.ahOrderId === String(payload.orderId) &&
      container?.dataset?.ahAmount === String(payload.amount.value) &&
      container?.dataset?.ahCurrency === String(payload.amount.currency);
  }

  function ensureModalActions(payload) {
    const modal = ah.sites.wave.transactionModal.findOpenModal();
    if (!modal) {
      removeModalActions();
      return;
    }
    document.querySelectorAll(`.${modalActionsClass}`).forEach((node) => {
      if (!modal.contains(node)) node.remove();
    });
    let actions = modal.querySelector(`.${modalActionsClass}`);
    if (!actions) {
      actions = renderModalActions(payload);
      modal.prepend(actions);
      return;
    }
    if (isSamePayload(actions, payload)) return;
    actions.replaceWith(renderModalActions(payload));
  }

  function ensureBanner(payload) {
    const panel = document.getElementById(bannerId);
    if (isSamePayload(panel, payload)) return;
    ah.ui.floatingPanel.ensure(bannerId, (node) => {
      node.dataset.ahOrderId = String(payload.orderId);
      node.dataset.ahAmount = String(payload.amount.value);
      node.dataset.ahCurrency = String(payload.amount.currency);
      return renderBanner(payload);
    });
  }

  async function maybeAutoFill(payload) {
    if (payload?.debug?.autoFillSuppressed) return;
    const key = payloadKey(payload);
    if (autoFillInFlight || createFillInFlight || autoFillAttemptKey === key) return;
    if (!ah.core.settings.get("aliToWave.autoFillPending", false)) return;
    if (!ah.sites.wave.transactionModal.findOpenModal()) return;
    autoFillAttemptKey = key;
    autoFillInFlight = true;
    try {
      await fillOpenTransaction(payload);
    } finally {
      autoFillInFlight = false;
    }
  }

  async function maybeAutoCreateWithdrawal(payload) {
    if (payload?.debug?.autoFillSuppressed) return;
    const key = payloadKey(payload);
    if (createFillInFlight || autoCreateAttemptKey === key) return;
    if (!ah.core.settings.get("aliToWave.autoCreateWithdrawal", false)) return;
    if (ah.sites.wave.transactionModal.findOpenModal()) return;
    autoCreateAttemptKey = key;
    const result = await createWithdrawalAndFill(payload, { toast: false });
    if (!result.ok) {
      ah.ui.toast.show(result.message, { tone: "warn" });
    }
  }

  function ensureWaveImportUI() {
    if (!ah.sites.wave.detect.isWave()) return;
    const payload = pendingPayload();
    if (!payload) {
      ah.ui.floatingPanel.remove(bannerId);
      removeModalActions();
      autoFillAttemptKey = "";
      autoCreateAttemptKey = "";
      return;
    }
    if (document.getElementById("ah-settings-modal")) {
      ah.ui.floatingPanel.remove(bannerId);
      removeModalActions();
      return;
    }
    if (ah.sites.wave.transactionModal.findOpenModal()) {
      ah.ui.floatingPanel.remove(bannerId);
      ensureModalActions(payload);
    } else {
      removeModalActions();
      ensureBanner(payload);
    }
    maybeAutoCreateWithdrawal(payload);
    maybeAutoFill(payload);
  }

  ah.features.aliToWave.importIntoWave = { pendingPayload, clearPendingPayload, fillOpenTransaction, createWithdrawalAndFill };
  ah.features.aliToWave.ensureWaveImportUI = ensureWaveImportUI;
  ah.features.aliToWave.getLastFillResult = () => ah.features.aliToWave.lastFillResult || null;
})();


/* src/features/diagnostics/index.js */
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


/* src/init.js */
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
        ah.core.settings.reset({ source: "debug-api" });
      },
      getSettingsBackup() {
        return ah.core.settings.backup();
      },
      restoreSettingsBackup() {
        return ah.core.settings.restoreBackup({ source: "debug-api" });
      },
      exportSettings() {
        return ah.core.settings.exportSettings("debug-api");
      },
      importSettings(value) {
        return ah.core.settings.importSettings(value, { source: "debug-api" });
      },
      getSettingsAuditLog() {
        return ah.core.settings.getAuditLog();
      },
      clearSettingsAuditLog() {
        return ah.core.settings.clearAuditLog();
      },
      getSettingsStatus() {
        return ah.core.settings.status();
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
    ah.core.settings.startupCheck({ showWarning: true });
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

    document.documentElement.dataset.accountingHelpersReadyVersion = ah.core.constants.version;
    document.documentElement.dataset.accountingHelpersReadyAt = new Date().toISOString();
    window.dispatchEvent(new CustomEvent("accounting-helpers:ready", {
      detail: {
        version: ah.core.constants.version,
        at: document.documentElement.dataset.accountingHelpersReadyAt
      }
    }));
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
