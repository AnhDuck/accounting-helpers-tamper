(function () {
  const devConfig = (
    typeof AccountingHelpersDevConfig !== "undefined" &&
    AccountingHelpersDevConfig &&
    typeof AccountingHelpersDevConfig === "object"
  ) ? AccountingHelpersDevConfig : window.AccountingHelpersDev || {};
  const devOrigin = devConfig.origin || "http://127.0.0.1:5173";
  const bundleUrl = devOrigin + "/accounting-helpers.dev-bundle.js";
  const statusUrl = devOrigin + "/accounting-helpers.dev-status.json";
  const grantNames = [
    "GM_addStyle",
    "GM_setClipboard",
    "GM_setValue",
    "GM_getValue",
    "GM_deleteValue",
    "GM_listValues",
    "GM_addValueChangeListener",
    "GM_openInTab",
    "GM_download",
    "GM_registerMenuCommand",
    "GM_xmlhttpRequest"
  ];

  const grants = {
    GM_addStyle: typeof GM_addStyle === "function" ? GM_addStyle : null,
    GM_setClipboard: typeof GM_setClipboard === "function" ? GM_setClipboard : null,
    GM_setValue: typeof GM_setValue === "function" ? GM_setValue : null,
    GM_getValue: typeof GM_getValue === "function" ? GM_getValue : null,
    GM_deleteValue: typeof GM_deleteValue === "function" ? GM_deleteValue : null,
    GM_listValues: typeof GM_listValues === "function" ? GM_listValues : null,
    GM_addValueChangeListener: typeof GM_addValueChangeListener === "function" ? GM_addValueChangeListener : null,
    GM_openInTab: typeof GM_openInTab === "function" ? GM_openInTab : null,
    GM_download: typeof GM_download === "function" ? GM_download : null,
    GM_registerMenuCommand: typeof GM_registerMenuCommand === "function" ? GM_registerMenuCommand : null,
    GM_xmlhttpRequest: typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : null
  };

  function installedBootstrapVersion() {
    if (devConfig.bootstrapVersion) return devConfig.bootstrapVersion;
    if (typeof GM_info !== "undefined" && GM_info?.script?.version) return GM_info.script.version;
    return "unknown";
  }

  function withCacheBust(url) {
    return url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
  }

  function requestText(url) {
    if (!grants.GM_xmlhttpRequest) {
      return fetch(withCacheBust(url), { cache: "no-store" }).then((response) => {
        if (response.ok) return response.text();
        throw new Error("HTTP " + response.status + " for " + url);
      });
    }

    return new Promise((resolve, reject) => {
      grants.GM_xmlhttpRequest({
        method: "GET",
        url: withCacheBust(url),
        headers: { "Cache-Control": "no-cache" },
        timeout: 10000,
        onload(response) {
          if (response.status >= 200 && response.status < 300) {
            resolve(response.responseText);
            return;
          }
          reject(new Error("HTTP " + response.status + " for " + url));
        },
        onerror() {
          reject(new Error("Network error for " + url));
        },
        ontimeout() {
          reject(new Error("Timeout loading " + url));
        }
      });
    });
  }

  function showLoadFailure(error) {
    console.error("[Accounting Helpers Dev] Failed to load local modules", error);
    const box = document.createElement("div");
    box.textContent = "Accounting Helpers Dev failed to load from " + devOrigin + ": " + error.message;
    box.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "left:12px",
      "bottom:12px",
      "max-width:520px",
      "padding:10px 12px",
      "border:1px solid #b91c1c",
      "background:#fef2f2",
      "color:#7f1d1d",
      "font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif",
      "box-shadow:0 8px 20px rgba(0,0,0,.18)"
    ].join(";");
    document.documentElement.appendChild(box);
  }

  function openUrl(url) {
    if (grants.GM_openInTab) {
      grants.GM_openInTab(url, { active: true, insert: true });
      return;
    }
    window.open(url, "_blank", "noopener");
  }

  function ensureDevStatusStyles() {
    if (document.getElementById("ah-dev-status-styles")) return;
    const css = `
      .ah-dev-status {
        align-items: center;
        background: #102b31;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 6px;
        bottom: 12px;
        box-shadow: 0 8px 22px rgba(0,0,0,.24);
        color: #fff;
        display: flex;
        flex-wrap: wrap;
        font: 12px/1.3 system-ui, -apple-system, Segoe UI, sans-serif;
        gap: 8px;
        left: 12px;
        max-width: min(680px, calc(100vw - 24px));
        padding: 8px 10px;
        position: fixed;
        z-index: 2147483646;
      }
      .ah-dev-status[data-state="stale"] {
        background: #451a03;
        border-color: #f59e0b;
      }
      .ah-dev-status strong { font-weight: 700; }
      .ah-dev-status button {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 5px;
        color: #0f172a;
        cursor: pointer;
        font: 700 12px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
        padding: 5px 8px;
      }
      .ah-dev-status button:hover { background: #e2e8f0; }
      .ah-dev-status .ah-dev-status-close {
        background: transparent;
        border-color: transparent;
        color: inherit;
        padding: 2px 5px;
      }
    `;
    const style = document.createElement("style");
    style.id = "ah-dev-status-styles";
    style.textContent = css;
    document.head.append(style);
  }

  function renderDevStatus(status) {
    ensureDevStatusStyles();
    const installed = installedBootstrapVersion();
    const expected = status.bootstrapVersion || "unknown";
    const state = installed === "unknown" ? "unknown" : installed === expected ? "ok" : "stale";
    const existing = document.getElementById("ah-dev-status");
    const node = existing || document.createElement("div");
    node.id = "ah-dev-status";
    node.className = "ah-dev-status";
    node.dataset.state = state;
    node.textContent = "";

    const summary = document.createElement("span");
    summary.textContent = [
      "Accounting Helpers Dev",
      "App " + (status.appVersion || "unknown"),
      "Bootstrap " + installed,
      "Server " + (status.ok ? "running" : "unknown")
    ].join(" | ");
    node.append(summary);

    if (state === "unknown") {
      const note = document.createElement("span");
      note.textContent = "Bootstrap version unavailable.";
      node.append(note);
    }

    if (state === "stale") {
      const warning = document.createElement("span");
      warning.textContent = "Bootstrap update available: " + expected;
      node.append(warning);

      if (status.devUserscriptUrl) {
        const update = document.createElement("button");
        update.type = "button";
        update.textContent = "Update dev script";
        update.addEventListener("click", () => openUrl(status.devUserscriptUrl));
        node.append(update);
      }
    }

    const close = document.createElement("button");
    close.type = "button";
    close.className = "ah-dev-status-close";
    close.textContent = "x";
    close.title = "Hide dev status for this page";
    close.addEventListener("click", () => {
      node.remove();
      document.documentElement.style.removeProperty("--ah-dev-status-offset");
    });
    node.append(close);

    if (!existing) document.documentElement.append(node);
    requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      const offset = Math.ceil(rect.height + 28);
      document.documentElement.style.setProperty("--ah-dev-status-offset", offset + "px");
    });
  }

  async function ensureDevStatus() {
    try {
      const status = JSON.parse(await requestText(statusUrl));
      renderDevStatus(status);
    } catch (error) {
      console.warn("[Accounting Helpers Dev] Failed to load dev status", error);
    }
  }

  async function loadLocalBundle() {
    const startedAt = performance.now();
    const source = await requestText(bundleUrl);
    new Function("AccountingHelpersDevConfig", ...grantNames, source + "\n//# sourceURL=" + bundleUrl)(
      devConfig,
      ...grantNames.map((name) => grants[name])
    );
    const duration = Math.round(performance.now() - startedAt);
    console.info("[Accounting Helpers Dev] Loaded local bundle from " + devOrigin + " in " + duration + "ms");
    ensureDevStatus();
  }

  loadLocalBundle().catch(showLoadFailure);
})();
