// ==UserScript==
// @name         Accounting Helpers Dev
// @namespace    https://github.com/AnhDuck/accounting-helpers-tamper
// @version      0.1.13-dev
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
    window.AccountingHelpersDev = Object.assign({}, window.AccountingHelpersDev, { origin: devOrigin });
    const source = await requestText(runtimeUrl);
    new Function(source + "\n//# sourceURL=" + runtimeUrl)();
  }

  loadRuntime().catch(showBootstrapFailure);
})();
