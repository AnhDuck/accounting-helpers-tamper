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

  ah.core.storage = { get, set, remove, keys, onChange };
})();
