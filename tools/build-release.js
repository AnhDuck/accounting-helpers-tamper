const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const version = "0.1.28";
const devBootstrapVersion = "0.1.17-dev";
const devOrigin = process.env.ACCOUNTING_HELPERS_DEV_ORIGIN || "http://127.0.0.1:5173";

const sourceFiles = [
  "src/core/constants.js",
  "src/core/logger.js",
  "src/core/storage.js",
  "src/core/settings.js",
  "src/core/dom.js",
  "src/core/clipboard.js",
  "src/core/react.js",
  "src/core/money.js",
  "src/core/dates.js",
  "src/core/events.js",
  "src/ui/styles.js",
  "src/ui/toast.js",
  "src/ui/floatingPanel.js",
  "src/ui/settingsModal.js",
  "src/sites/wave/detect.js",
  "src/sites/wave/selectors.js",
  "src/sites/wave/heartbeat.js",
  "src/sites/wave/dropdowns.js",
  "src/sites/wave/transactionModal.js",
  "src/sites/wave/transactionList.js",
  "src/sites/wave/fillTransaction.js",
  "src/sites/aliexpress/detect.js",
  "src/sites/aliexpress/selectors.js",
  "src/sites/aliexpress/extractOrder.js",
  "src/sites/amazon/detect.js",
  "src/sites/amazon/selectors.js",
  "src/sites/amazon/invoices.js",
  "src/sites/amazon/extractOrder.js",
  "src/features/waveSavingsDashboard/index.js",
  "src/features/waveTaxButtons/index.js",
  "src/features/waveAccountSwitcher/index.js",
  "src/features/waveReviewedSave/index.js",
  "src/features/aliexpressCadCopy/index.js",
  "src/features/aliexpressCartPerUnit/index.js",
  "src/features/aliToWave/payload.js",
  "src/features/aliToWave/duplicateGuard.js",
  "src/features/aliToWave/stageFromAliExpress.js",
  "src/features/aliToWave/importIntoWave.js",
  "src/features/amazonToWave/payload.js",
  "src/features/amazonToWave/stageFromAmazon.js",
  "src/features/amazonToWave/applyIntoWave.js",
  "src/features/amazonOrders/index.js",
  "src/features/diagnostics/index.js",
  "src/init.js"
];

function userscriptHeader({ name, scriptVersion, description, updateUrls = false, devUpdateUrls = false, devConnect = false }) {
  const updateUrlLines = updateUrls
    ? `// @updateURL    https://raw.githubusercontent.com/AnhDuck/accounting-helpers-tamper/master/userscript/accounting-helpers.release.user.js
// @downloadURL  https://raw.githubusercontent.com/AnhDuck/accounting-helpers-tamper/master/userscript/accounting-helpers.release.user.js
`
    : "";
  const devUpdateUrlLines = devUpdateUrls
    ? `// @updateURL    ${devOrigin}/userscript/accounting-helpers.dev.user.js
// @downloadURL  ${devOrigin}/userscript/accounting-helpers.dev.user.js
`
    : "";
  const devConnectLines = devConnect
    ? `// @connect      127.0.0.1
// @connect      localhost
`
    : "";

  return `// ==UserScript==
// @name         ${name}
// @namespace    https://github.com/AnhDuck/accounting-helpers-tamper
// @version      ${scriptVersion}
// @description  ${description}
// @match        https://next.waveapps.com/*
// @match        https://www.aliexpress.com/p/order/index.html*
// @match        https://www.aliexpress.com/p/shoppingcart/index.html*
// @match        https://www.amazon.ca/*your-orders*
// @match        https://www.amazon.ca/*order-history*
// @match        https://www.amazon.com/*your-orders*
// @match        https://www.amazon.com/*order-history*
// @match        https://www.amazon.co.uk/*your-orders*
// @match        https://www.amazon.co.uk/*order-history*
${updateUrlLines}${devUpdateUrlLines}// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_openInTab
// @grant        GM_download
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      open.er-api.com
${devConnectLines}// ==/UserScript==
`;
}

const releaseHeader = userscriptHeader({
  name: "Accounting Helpers",
  scriptVersion: version,
  description: "Modular accounting workflow helpers for WaveApps, AliExpress, and future sites.",
  updateUrls: true
});

function devLoaderScript() {
  const devHeader = userscriptHeader({
    name: "Accounting Helpers Dev",
    scriptVersion: devBootstrapVersion,
    description: "Runtime loader for local Accounting Helpers modules.",
    devUpdateUrls: true,
    devConnect: true
  });

  return `${devHeader}
(function () {
  const devOrigin = ${JSON.stringify(devOrigin)};
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
      bootstrapVersion: ${JSON.stringify(devBootstrapVersion)},
      origin: devOrigin
    });
    const source = await requestText(runtimeUrl);
    new Function("AccountingHelpersDevConfig", ...grantNames, source + "\\n//# sourceURL=" + runtimeUrl)(
      devConfig,
      ...grantNames.map((name) => grants[name])
    );
  }

  loadRuntime().catch(showBootstrapFailure);
})();
`;
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8").trim();
}

function build() {
  const missing = sourceFiles.filter((file) => !fs.existsSync(path.join(root, file)));
  if (missing.length) {
    throw new Error(`Missing files:\n${missing.join("\n")}`);
  }

  const body = sourceFiles
    .map((file) => `\n/* ${file} */\n${read(file)}\n`)
    .join("\n");

  const output = `${releaseHeader}\n${body}`;
  const distDir = path.join(root, "dist");
  const userscriptDir = path.join(root, "userscript");
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(userscriptDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, "accounting-helpers.user.js"), output);
  fs.writeFileSync(path.join(distDir, "accounting-helpers.modules.json"), `${JSON.stringify({ files: sourceFiles }, null, 2)}\n`);
  fs.writeFileSync(path.join(userscriptDir, "accounting-helpers.release.user.js"), output);
  fs.writeFileSync(path.join(userscriptDir, "accounting-helpers.dev.user.js"), devLoaderScript());
  console.log(`Built ${sourceFiles.length} modules into dist/accounting-helpers.user.js`);
  console.log("Updated userscript/accounting-helpers.dev.user.js");
}

if (require.main === module) {
  build();
}

module.exports = {
  devBootstrapVersion,
  build,
  root,
  sourceFiles,
  version
};
