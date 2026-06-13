# Agent Notes

Keep this repo as one Tampermonkey userscript, not a Chrome extension.

Rules:

- Do not use Wave or AliExpress APIs.
- Do not commit personal account names, credit card digits, private vendors, business categories, order history, or local debug endpoints.
- Put user-specific defaults in `GM_setValue`/`GM_getValue` through `src/core/settings.js`.
- Keep feature modules small and expose one public `ensure()` entrypoint.
- Update `tools/build-release.js` when adding or removing source modules.
- Bump the userscript version in `tools/build-release.js` and `src/core/constants.js` for every user-facing behavior, settings, or UI change.
- Run `node tools/build-release.js` before testing the installable release script.
