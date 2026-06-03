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
