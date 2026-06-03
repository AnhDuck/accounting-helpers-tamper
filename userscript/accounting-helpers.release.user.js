// ==UserScript==
// @name         Accounting Helpers
// @namespace    https://github.com/AnhDuck/accounting-helpers-tamper
// @version      0.1.0
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

  function hasGm(name) {
    return typeof window[name] === "function";
  }

  function localKey(key) {
    return `AccountingHelpers.${key}`;
  }

  function get(key, fallback) {
    try {
      if (hasGm("GM_getValue")) return GM_getValue(key, fallback);
      const raw = localStorage.getItem(localKey(key));
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      ah.core.logger?.warn("Storage read failed", { key, error: String(error) });
      return fallback;
    }
  }

  function set(key, value) {
    try {
      if (hasGm("GM_setValue")) {
        GM_setValue(key, value);
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
      if (hasGm("GM_deleteValue")) GM_deleteValue(key);
      else localStorage.removeItem(localKey(key));
      return true;
    } catch (error) {
      ah.core.logger?.error("Storage delete failed", { key, error: String(error) });
      return false;
    }
  }

  function keys() {
    try {
      if (hasGm("GM_listValues")) return GM_listValues();
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
    if (hasGm("GM_addValueChangeListener")) {
      return GM_addValueChangeListener(key, (_name, oldValue, newValue, remote) => {
        callback(newValue, oldValue, remote);
      });
    }
    window.addEventListener("storage", (event) => {
      if (event.key !== localKey(key)) return;
      callback(JSON.parse(event.newValue), JSON.parse(event.oldValue), true);
    });
    return null;
  }

  ah.core.storage = { get, set, remove, keys, onChange };
})();


/* src/core/settings.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  const KEY = ah.core.constants.storageKeys.settings;

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
      autoFillPending: false,
      autoSaveAfterFill: false,
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

  function all() {
    return merge(defaults, ah.core.storage.get(KEY, {}));
  }

  function save(nextSettings) {
    const ok = ah.core.storage.set(KEY, merge(defaults, nextSettings));
    if (ok) {
      window.dispatchEvent(new CustomEvent(ah.core.constants.events.settingsChanged, { detail: all() }));
    }
    return ok;
  }

  function get(path, fallback) {
    return pathGet(all(), path, fallback);
  }

  function set(path, value) {
    const next = all();
    pathSet(next, path, value);
    return save(next);
  }

  function reset() {
    ah.core.storage.remove(KEY);
    window.dispatchEvent(new CustomEvent(ah.core.constants.events.settingsChanged, { detail: all() }));
  }

  ah.core.settings = { defaults: clone(defaults), all, save, get, set, reset };
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
      .ah-pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
      .ah-toast-layer {
        bottom: 18px;
        display: grid;
        gap: 8px;
        position: fixed;
        right: 18px;
        width: min(360px, calc(100vw - 36px));
        z-index: 2147483647;
      }
      .ah-toast {
        background: #13292f;
        border-left: 4px solid #39a16f;
        border-radius: 6px;
        box-shadow: 0 10px 30px rgba(0,0,0,.24);
        color: #fff;
        font: 13px/1.35 system-ui, -apple-system, Segoe UI, sans-serif;
        padding: 10px 12px;
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
      .ah-modal-backdrop {
        align-items: center;
        background: rgba(18, 35, 40, .52);
        display: flex;
        inset: 0;
        justify-content: center;
        position: fixed;
        z-index: 2147483647;
      }
      .ah-modal {
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 18px 54px rgba(0,0,0,.28);
        color: #152d34;
        max-height: min(760px, calc(100vh - 32px));
        overflow: auto;
        padding: 18px;
        width: min(680px, calc(100vw - 32px));
      }
      .ah-modal h2 { font: 700 18px/1.2 system-ui, sans-serif; margin: 0 0 14px; }
      .ah-modal h3 { font: 700 14px/1.2 system-ui, sans-serif; margin: 18px 0 8px; }
      .ah-form-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      .ah-field { display: grid; gap: 4px; }
      .ah-field label { font: 600 12px/1.2 system-ui, sans-serif; }
      .ah-field input, .ah-field select {
        border: 1px solid #aebdc2;
        border-radius: 6px;
        font: 14px/1.2 system-ui, sans-serif;
        min-height: 34px;
        padding: 6px 8px;
      }
      .ah-check { align-items: center; display: flex; gap: 8px; min-height: 30px; }
      .ah-check input { margin: 0; }
      .ah-modal-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: 16px; }
      .ah-ae-row { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
      .ah-ae-total { color: #184f61; font-weight: 700; }
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

  function show(message, options) {
    const layer = ensureToastLayer();
    const toast = document.createElement("div");
    toast.className = "ah-toast";
    toast.textContent = message;
    if (options?.tone === "error") toast.style.borderLeftColor = "#d85a4a";
    if (options?.tone === "warn") toast.style.borderLeftColor = "#c99023";
    layer.append(toast);
    setTimeout(() => toast.remove(), options?.timeout || 4200);
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

  const fields = [
    ["wave.defaultAliExpressVendor", "Default Wave vendor", "text"],
    ["wave.defaultAliExpressAccount", "Default Wave account", "text"],
    ["wave.defaultAliExpressCategory", "Default Wave category", "text"],
    ["wave.descriptionPrefix", "AliExpress description prefix", "text"],
    ["wave.accounts.amex", "Account 1", "text"],
    ["wave.accounts.creditCard", "Account 2", "text"],
    ["aliExpress.defaultCurrency", "AliExpress source currency", "text"],
    ["aliExpress.targetCurrency", "Accounting target currency", "text"]
  ];

  const checks = [
    ["wave.autoUpdateTaxPopover", "Auto update Wave tax popover"],
    ["wave.markReviewedAutoSave", "Mark reviewed auto-save"],
    ["aliToWave.autoOpenWave", "Open Wave after Send to Wave"],
    ["aliToWave.autoFillPending", "Auto-fill pending payload when a Wave modal is open"],
    ["aliToWave.autoSaveAfterFill", "Auto-save after AliExpress import"],
    ["aliToWave.allowReimport", "Allow re-import of already imported AliExpress orders"]
  ];

  function inputFor(path, label, type) {
    const wrapper = ah.core.dom.el("div", { class: "ah-field" });
    const id = `ah-setting-${path.replace(/\W/g, "-")}`;
    const input = ah.core.dom.el("input", { id, type: type || "text", "data-setting-path": path });
    input.value = ah.core.settings.get(path, "");
    wrapper.append(ah.core.dom.el("label", { for: id }, label), input);
    return wrapper;
  }

  function selectFor(path, label, options) {
    const wrapper = ah.core.dom.el("div", { class: "ah-field" });
    const id = `ah-setting-${path.replace(/\W/g, "-")}`;
    const select = ah.core.dom.el("select", { id, "data-setting-path": path });
    options.forEach((option) => select.append(ah.core.dom.el("option", { value: option }, option)));
    select.value = ah.core.settings.get(path, options[0]);
    wrapper.append(ah.core.dom.el("label", { for: id }, label), select);
    return wrapper;
  }

  function checkFor(path, label) {
    const input = ah.core.dom.el("input", { type: "checkbox", "data-setting-path": path });
    input.checked = !!ah.core.settings.get(path, false);
    const wrapper = ah.core.dom.el("label", { class: "ah-check" }, [input, ah.core.dom.el("span", {}, label)]);
    return wrapper;
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
        ah.core.settings.set(path, value);
        ah.ui.toast.show(`${label} saved.`);
      }
    }, label);
  }

  function open() {
    ah.ui.styles.ensureStyles();
    document.getElementById("ah-settings-modal")?.remove();

    const settings = ah.core.settings.all();
    const backdrop = ah.core.dom.el("div", { id: "ah-settings-modal", class: "ah-modal-backdrop" });
    const modal = ah.core.dom.el("div", { class: "ah-modal", role: "dialog", "aria-modal": "true" });

    const form = ah.core.dom.el("form", {});
    const grid = ah.core.dom.el("div", { class: "ah-form-grid" });
    fields.forEach(([path, label, type]) => grid.append(inputFor(path, label, type)));
    grid.append(selectFor("wave.defaultAliExpressType", "Default Wave transaction type", ["Withdrawal", "Deposit"]));

    const checkGrid = ah.core.dom.el("div", { class: "ah-form-grid" });
    checks.forEach(([path, label]) => checkGrid.append(checkFor(path, label)));

    const captureRow = ah.core.dom.el("div", { class: "ah-pill-row" });
    if (ah.sites.wave?.detect?.isWave()) {
      captureRow.append(
        captureButton("Use current account", "wave.defaultAliExpressAccount", () =>
          ah.sites.wave.transactionModal.readField(["account", "payment account"])
        ),
        captureButton("Save current account as Account 1", "wave.accounts.amex", () =>
          ah.sites.wave.transactionModal.readField(["account", "payment account"]),
          "Save the current Wave Account field as Account 1 in local Tampermonkey settings. Switch account uses Account 1 and Account 2."
        ),
        captureButton("Save current account as Account 2", "wave.accounts.creditCard", () =>
          ah.sites.wave.transactionModal.readField(["account", "payment account"]),
          "Save the current Wave Account field as Account 2 in local Tampermonkey settings. Switch account uses Account 1 and Account 2."
        ),
        captureButton("Use current category", "wave.defaultAliExpressCategory", () =>
          ah.sites.wave.transactionModal.readField(["category"])
        ),
        captureButton("Use current vendor", "wave.defaultAliExpressVendor", () =>
          ah.sites.wave.transactionModal.readField(["vendor", "payee", "merchant"])
        )
      );
    }

    const actions = ah.core.dom.el("div", { class: "ah-modal-actions" }, [
      ah.core.dom.el("button", { type: "button", class: "ah-button ah-button-secondary", onclick: close }, "Cancel"),
      ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        onclick: () => {
          if (confirm("Reset Accounting Helpers settings?")) {
            ah.core.settings.reset();
            close();
            ah.ui.toast.show("Settings reset.");
          }
        }
      }, "Reset"),
      ah.core.dom.el("button", { type: "submit", class: "ah-button" }, "Save")
    ]);

    form.append(
      ah.core.dom.el("h2", {}, "Accounting Helpers Settings"),
      ah.core.dom.el("h3", {}, "Wave and AliExpress defaults"),
      grid,
      ah.core.dom.el("h3", {}, "Automation"),
      checkGrid
    );
    if (captureRow.childElementCount) {
      form.append(ah.core.dom.el("h3", {}, "Capture from current Wave transaction"), captureRow);
    }
    form.append(actions);

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
      ah.core.settings.save(next);
      close();
      ah.ui.toast.show("Settings saved.");
    });

    modal.append(form);
    backdrop.append(modal);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    document.body.append(backdrop);
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


/* src/sites/wave/dropdowns.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  const dom = () => ah.core.dom;

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

    ah.core.react.setFieldValue(field, optionText);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const option = dom().findByText(document, "[role='option'], li, button, [data-testid*='option']", optionText);
    if (option) {
      option.click();
      return true;
    }
    return true;
  }

  function getVisibleSelection(labels) {
    const field = ah.sites.wave.transactionModal.findField(labels);
    if (!field) return "";
    return field.value || field.getAttribute("aria-label") || dom().text(field);
  }

  ah.sites.wave.dropdowns = { chooseOption, getVisibleSelection };
})();


/* src/sites/wave/transactionModal.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  function findOpenModal() {
    const selector = ah.sites.wave.selectors.modal;
    return ah.core.dom.visible(ah.core.dom.qsa(selector)).at(-1) || null;
  }

  function findField(labels) {
    const root = findOpenModal() || document;
    return ah.core.dom.findFieldByLabel(root, labels);
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
      .map((label) => ah.core.dom.findByText(root, ah.sites.wave.selectors.buttons, label))
      .find(Boolean);
    if (!button) return false;
    button.click();
    return true;
  }

  ah.sites.wave.transactionModal = { findOpenModal, findField, readField, setField, clickButton };
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

  ah.sites.wave.transactionList = { findCurrentRow, clickCopyOnCurrentRow };
})();


/* src/sites/wave/fillTransaction.js */
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
    const ownAttr = source.getAttribute?.("data-order-id");
    if (ownAttr) return ownAttr;
    const fromAttr = ah.core.dom.qsa("[data-order-id]", source).map((node) => node.getAttribute("data-order-id")).find(Boolean);
    if (fromAttr) return fromAttr;

    const bodyText = ah.core.dom.text(source);
    const labelMatch = bodyText.match(/(?:order\s*(?:id|number|no\.?)\s*[:#]?\s*)(\d{8,})/i);
    if (labelMatch) return labelMatch[1];
    const longNumber = bodyText.match(/\b\d{12,20}\b/);
    return longNumber ? longNumber[0] : "";
  }

  function hasOrderPayloadContext(source) {
    return !!source?.querySelector?.(".ah-send-to-wave, .ah-ae-cad-row, .ae-helper-cad-row, [data-ah-cad-total]");
  }

  function findOrderRoot(startNode) {
    const start = startNode?.nodeType === Node.ELEMENT_NODE ? startNode : startNode?.parentElement;
    const fallbackStart = start || document.querySelector(".ah-send-to-wave") || document.getElementById("ah-send-to-wave");
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
    const labelMatch = bodyText.match(/(?:order\s*(?:date|time)|placed\s*on)\s*[:#]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i);
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
    const existing = [source, ...ah.core.dom.qsa("[data-ah-cad-total]", source)]
      .map((node) => node.getAttribute?.("data-ah-cad-total") || node.dataset?.value || ah.core.dom.text(node))
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
      panel.append(ah.core.dom.el("strong", { "data-ah-wave-panel-title": "1" }, "Wave Helpers"));
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
      ah.core.settings.set("wave.autoUpdateTaxPopover", checkbox.checked);
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
      ah.core.settings.set("wave.markReviewedAutoSave", checkbox.checked);
      ah.ui.toast.show(`Mark reviewed auto-save ${checkbox.checked ? "ON" : "OFF"}.`);
    });
    panel.append(ah.core.dom.el("label", { class: "ah-check", style: "white-space:nowrap;" }, [checkbox, "Reviewed auto-save"]));
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
      orderId,
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
    return !!(
      payload &&
      payload.version === ALI_TO_WAVE_PAYLOAD_VERSION &&
      payload.source === "aliexpress" &&
      payload.target === "wave" &&
      payload.orderId &&
      payload.amount?.value
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

  function orderFromButton(button) {
    const row = button.closest(".ah-ae-cad-row, .ae-helper-cad-row, [data-ah-cad-total]") || button;
    const root = ah.sites.aliexpress.extractOrder.findOrderRoot(row);
    return {
      orderId: ah.sites.aliexpress.extractOrder.extractOrderId(root),
      orderDate: ah.sites.aliexpress.extractOrder.extractOrderDate(root),
      cadTotal: ah.sites.aliexpress.extractOrder.extractCadTotal(root),
      sourceUrl: location.href,
      root
    };
  }

  async function sendToWave(button) {
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

    savePendingPayload(payload);
    setButtonState(button, "Sent to Wave", "disabled");
    ah.ui.toast.show("AliExpress order staged for Wave.");

    if (ah.core.settings.get("aliToWave.autoOpenWave", false) && typeof GM_openInTab === "function") {
      GM_openInTab(ah.core.constants.waveTransactionsUrl, { active: true, insert: true });
    }
  }

  function injectButton(row) {
    if (!row || row.querySelector(".ah-send-to-wave")) return;
    const value = ah.core.money.parseMoney(row.getAttribute("data-ah-cad-total") || row.querySelector("[data-ah-cad-total]")?.dataset.value);
    if (value === null) return;
    const button = ah.core.dom.el("button", {
      type: "button",
      class: "ah-button ah-send-to-wave",
      onclick: () => sendToWave(button)
    }, "Send to Wave");
    row.append(button);

    const order = orderFromButton(button);
    if (order.orderId && ah.features.aliToWave.duplicateGuard.isImported(order.orderId) && !ah.core.settings.get("aliToWave.allowReimport", false)) {
      setButtonState(button, "Already imported", "disabled");
    }
  }

  function ensureAliExpressSendButton() {
    if (!ah.sites.aliexpress.detect.isOrderPage()) return;
    document.querySelectorAll(".ah-ae-cad-row, .ae-helper-cad-row").forEach(injectButton);
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
  let autoFillInFlight = false;

  function pendingPayload() {
    const payload = ah.core.storage.get(pendingKey, null);
    return ah.features.aliToWave.payload.isValidPayload(payload) ? payload : null;
  }

  function clearPendingPayload() {
    ah.core.storage.remove(pendingKey);
    ah.ui.floatingPanel.remove("ah-ali-to-wave-banner");
    window.dispatchEvent(new CustomEvent(ah.core.constants.events.pendingPayloadChanged));
  }

  async function fillOpenTransaction(payload) {
    const result = await ah.sites.wave.fillTransaction.fillFromAliPayload(payload);
    ah.ui.toast.show(result.message, { tone: result.ok ? "success" : "warn" });
    if (result.ok) {
      ah.features.aliToWave.duplicateGuard.markImported(payload);
      clearPendingPayload();
    }
    return result;
  }

  function renderBanner(payload) {
    const amount = ah.core.money.formatCurrency(payload.amount.value, payload.amount.currency);
    const content = ah.core.dom.el("div", {}, [
      ah.core.dom.el("strong", {}, `Pending AliExpress order: ${payload.orderId}`),
      ah.core.dom.el("div", { style: "margin-bottom:8px;" }, amount),
      ah.core.dom.el("div", { class: "ah-pill-row" }, [
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button",
          onclick: () => fillOpenTransaction(payload)
        }, "Fill open transaction"),
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button ah-button-secondary",
          onclick: clearPendingPayload
        }, "Clear")
      ])
    ]);
    return content;
  }

  async function maybeAutoFill(payload) {
    if (autoFillInFlight || !ah.core.settings.get("aliToWave.autoFillPending", false)) return;
    if (!ah.sites.wave.transactionModal.findOpenModal()) return;
    autoFillInFlight = true;
    try {
      await fillOpenTransaction(payload);
    } finally {
      autoFillInFlight = false;
    }
  }

  function ensureWaveImportUI() {
    if (!ah.sites.wave.detect.isWave()) return;
    const payload = pendingPayload();
    if (!payload) {
      ah.ui.floatingPanel.remove("ah-ali-to-wave-banner");
      return;
    }
    ah.ui.floatingPanel.ensure("ah-ali-to-wave-banner", () => renderBanner(payload));
    maybeAutoFill(payload);
  }

  ah.features.aliToWave.importIntoWave = { pendingPayload, clearPendingPayload, fillOpenTransaction };
  ah.features.aliToWave.ensureWaveImportUI = ensureWaveImportUI;
})();


/* src/init.js */
(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};

  function installDebugObject() {
    if (window.AccountingHelpersDebug) return;
    window.AccountingHelpersDebug = {
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
      }
    };
  }

  function ensureAll() {
    ah.ui.styles.ensureStyles();
    ah.ui.toast.ensureToastLayer();
    ah.ui.settingsModal.registerMenuCommand();
    installDebugObject();

    if (ah.sites.wave.detect.isWave()) {
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

  const scheduleEnsureAll = ah.core.events.rafThrottle(ensureAll);

  function start() {
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
