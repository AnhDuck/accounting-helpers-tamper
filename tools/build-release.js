const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const header = `// ==UserScript==
// @name         Accounting Helpers
// @namespace    https://github.com/AnhDuck/accounting-helpers-tamper
// @version      0.1.10
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
`;

const files = [
  "src/core/constants.js",
  "src/core/logger.js",
  "src/core/storage.js",
  "src/core/settings.js",
  "src/core/dom.js",
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
  "src/init.js"
];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8").trim();
}

function build() {
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  if (missing.length) {
    throw new Error(`Missing files:\n${missing.join("\n")}`);
  }

  const body = files
    .map((file) => `\n/* ${file} */\n${read(file)}\n`)
    .join("\n");

  const output = `${header}\n${body}`;
  const distDir = path.join(root, "dist");
  const userscriptDir = path.join(root, "userscript");
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(userscriptDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, "accounting-helpers.user.js"), output);
  fs.writeFileSync(path.join(userscriptDir, "accounting-helpers.release.user.js"), output);
  console.log(`Built ${files.length} modules into dist/accounting-helpers.user.js`);
}

build();
