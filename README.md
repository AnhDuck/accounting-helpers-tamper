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

Refresh the Wave or AliExpress page after editing source files. Normal code edits do not require reinstalling the Tampermonkey script while `tools/dev-server.js` is running. When adding, removing, or reordering modules, update `sourceFiles` in `tools/build-release.js` and rerun the build.

The app/release version and dev bootstrap version are intentionally separate:

- `version` in `tools/build-release.js` and `src/core/constants.js` is the app/release version.
- `devBootstrapVersion` in `tools/build-release.js` is only for the installed Tampermonkey dev bootstrap.
- Ordinary app, module, UI, selector, and runtime changes should not require a Tampermonkey update.
- Metadata changes such as new `@match`, `@grant`, or `@connect` entries still require a Tampermonkey update.

The dev runtime shows a compact in-page status panel with the app version, installed bootstrap version, server status, and an update button when the bootstrap is stale.

Agent validation should use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/restart-dev-server.ps1
```

That command stops any stale dev server, rebuilds the generated userscripts, starts the server in the background, and checks `http://127.0.0.1:5173/health`.

Tampermonkey limitation: agents cannot directly edit the installed Tampermonkey script. To avoid that problem, keep the installed dev userscript as a stable bootstrap and put future loader changes in `tools/dev-runtime.js`. Metadata changes such as new `@match`, `@grant`, or `@connect` entries still require a one-time Tampermonkey update by the user.

To start the dev server automatically after Windows login, run once:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/install-dev-server-startup-task.ps1
```

## Debug

The script exposes:

```js
window.AccountingHelpersDebug
```

Available helpers include settings, pending AliExpress payload, imported-order history, and logs.
