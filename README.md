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

`userscript/accounting-helpers.dev.user.js` loads files from:

```text
http://127.0.0.1:5173/src/...
```

Use any static server rooted at this repo if you want live module loading during development.

## Debug

The script exposes:

```js
window.AccountingHelpersDebug
```

Available helpers include settings, pending AliExpress payload, imported-order history, and logs.
