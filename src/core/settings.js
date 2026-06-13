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
      autoCreateWithdrawal: false,
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
