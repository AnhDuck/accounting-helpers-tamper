// ==UserScript==
// @name         Accounting Helpers Dev
// @namespace    https://github.com/AnhDuck/accounting-helpers-tamper
// @version      0.1.17-dev
// @description  Runtime loader for local Accounting Helpers modules.
// @match        https://next.waveapps.com/*
// @match        https://www.aliexpress.com/p/order/index.html*
// @match        https://www.aliexpress.com/p/shoppingcart/index.html*
// @updateURL    http://127.0.0.1:5173/userscript/accounting-helpers.dev.user.js
// @downloadURL  http://127.0.0.1:5173/userscript/accounting-helpers.dev.user.js
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
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
  const devOrigin = "http://127.0.0.1:5173";
  const runtimeUrl = devOrigin + "/accounting-helpers.dev-runtime.js";
  const grantNames = [
    "GM_addStyle",
    "GM_setClipboard",
    "GM_setValue",
    "GM_getValue",
    "GM_deleteValue",
    "GM_listValues",
    "GM_addValueChangeListener",
    "GM_openInTab",
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
    GM_registerMenuCommand: typeof GM_registerMenuCommand === "function" ? GM_registerMenuCommand : null,
    GM_xmlhttpRequest: typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : null
  };

  function withCacheBust(url) {
    return url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
  }

  function requestText(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
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

  function showBootstrapFailure(error) {
    console.error("[Accounting Helpers Dev] Failed to load local runtime", error);
    const box = document.createElement("div");
    box.textContent = "Accounting Helpers Dev failed to load runtime from " + devOrigin + ": " + error.message;
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

  async function loadRuntime() {
    const devConfig = Object.freeze({
      bootstrapVersion: "0.1.17-dev",
      origin: devOrigin
    });
    const source = await requestText(runtimeUrl);
    new Function("AccountingHelpersDevConfig", ...grantNames, source + "\n//# sourceURL=" + runtimeUrl)(
      devConfig,
      ...grantNames.map((name) => grants[name])
    );
  }

  loadRuntime().catch(showBootstrapFailure);
})();
