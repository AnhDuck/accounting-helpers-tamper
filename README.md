# Accounting Helpers Tampermonkey

Modular Tampermonkey userscript for browser-page accounting workflow automation across WaveApps, AliExpress, and future sites.

This is not a Chrome extension and does not use Wave or AliExpress APIs. It automates visible pages through DOM injection and local Tampermonkey storage.

## Architecture

The repo uses a small module layout:

- `src/core`: shared utilities for DOM, React inputs, storage, settings, logging, money, dates, and events.
- `src/ui`: shared styles, toast layer, floating panels, and the settings modal.
- `src/sites`: site-specific detection/selectors/adapters.
- `src/features`: user-facing features with one `ensure()` entrypoint per feature.
- `src/init.js`: central dispatcher that runs only the features relevant to the current site.

The release script concatenates these modules into one Tampermonkey userscript. There is no runtime bundler and no extension layer.

## Features

- Wave tax buttons: Apply GST, Apply PST, and Apply GST + PST through the existing tax popover hidden select.
- Wave reviewed-save helper: optional Mark reviewed -> Save automation.
- Wave account switcher: local settings-based account switching with capture buttons.
- Wave savings dashboard: local clicks/time-saved counter with a compact dashboard.
- AliExpress order helper: CAD total row, copy button, USD -> CAD conversion via `open.er-api.com`.
- AliExpress cart helper: per-unit cost when exactly one cart item is selected.
- AliExpress -> Wave MVP: stage an AliExpress order payload and fill an already-open Wave transaction modal.

## Private Settings

No account names, card digits, business category defaults, or private vendor labels should be committed. Configure them locally from Tampermonkey:

`Accounting Helpers: Open Settings`

Settings are stored with `GM_setValue`/`GM_getValue`.

The dev userscript is named `Accounting Helpers Dev`; the release userscript is named `Accounting Helpers`. Tampermonkey treats script identity as part of stored-value ownership, so dev and release settings can be separate. Use Settings > Data to export settings before switching between dev and release, and import or restore from backup if settings appear missing.

## Build

```powershell
node tools/build-release.js
```

Install:

```text
dist/accounting-helpers.user.js
```

## Development Loader

To start or restart the local dev server manually:

```powershell
.\start-dev-server.bat
```

Install the dev userscript from:

```text
http://127.0.0.1:5173/userscript/accounting-helpers.dev.user.js
```

The installed dev userscript is a stable bootstrap. It loads the changeable dev runtime from:

```text
http://127.0.0.1:5173/accounting-helpers.dev-runtime.js
```

That runtime loads one live bundle from:

```text
http://127.0.0.1:5173/accounting-helpers.dev-bundle.js
```

The dev server generates that bundle from the current source files on each request. The ordered module manifest is also available for diagnostics at:

```text
http://127.0.0.1:5173/accounting-helpers.modules.json
```

Refresh the Wave or AliExpress page after editing source files. Normal source, UI, selector, and runtime edits do not require reinstalling the Tampermonkey script while `tools/dev-server.js` is running. They also do not usually require restarting the server because the runtime, status endpoint, and live bundle are read from disk on request.

Validation must happen in Chrome with the user's installed Tampermonkey script. The Codex in-app browser is not suitable for this application because it does not run the installed Tampermonkey userscript, its grants, or the same GM storage identity.

After refreshing Wave or AliExpress, wait for the userscript to finish injecting before running diagnostics. Wave can render its app shell before Accounting Helpers appears. Reliable readiness signals are:

- `document.documentElement.dataset.accountingHelpersReadyVersion`
- `document.documentElement.dataset.accountingHelpersReadyAt`
- `#ah-diagnostics-panel`
- `#ah-dev-status`

If those signals are not present immediately after refresh, wait and check again before treating the helper as missing.

Before restarting the dev server, check:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5173/accounting-helpers.dev-status.json
```

Restart only when one of these is true:

- The status or health endpoint is unreachable.
- The reported app version, bootstrap version, module count, runtime URL, or bundle URL is stale or wrong after running `node tools/build-release.js`.
- `tools/dev-server.js`, `tools/dev-runtime.js`, server startup scripts, or generated userscript metadata/bootstrap behavior changed.
- The existing dev server is serving errors, stale files, or an unknown process state.

When adding, removing, or reordering modules, update `sourceFiles` in `tools/build-release.js` and rerun the build.

The app/release version and dev bootstrap version are intentionally separate:

- `version` in `tools/build-release.js` and `src/core/constants.js` is the app/release version.
- `devBootstrapVersion` in `tools/build-release.js` is only for the installed Tampermonkey dev bootstrap.
- Ordinary app, module, UI, selector, and runtime changes should not require a Tampermonkey update.
- Metadata changes such as new `@match`, `@grant`, or `@connect` entries still require a Tampermonkey update.

The dev runtime shows a compact in-page status panel with the app version, installed bootstrap version, server status, and an update button when the bootstrap is stale.

When a restart is actually needed, use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/restart-dev-server.ps1
```

That command stops any stale dev server, rebuilds the generated userscripts, starts the server in the background, and checks `http://127.0.0.1:5173/health`.

For ordinary source validation when the status endpoint is already healthy and current, do not restart. Run `node tools/build-release.js`, then refresh the relevant Wave or AliExpress browser page so Tampermonkey loads the latest served runtime and bundle.

Tampermonkey limitation: agents cannot directly edit the installed Tampermonkey script. To avoid that problem, keep the installed dev userscript as a stable bootstrap and put future loader changes in `tools/dev-runtime.js`. Metadata changes such as new `@match`, `@grant`, or `@connect` entries still require a one-time Tampermonkey update by the user.

To start the dev server automatically after Windows login, run once:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/install-dev-server-startup-task.ps1
```

If Windows denies Task Scheduler access, the installer creates a Startup-folder shortcut that runs the same restart script at login.

## Debug

The script exposes:

```js
window.AccountingHelpersDebug
```

Available helpers include settings, pending AliExpress payload, imported-order history, and logs.
