(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.ui = ah.ui || {};

  function ensureStyles() {
    if (document.getElementById("ah-shared-styles")) return;
    const css = `
      .ah-hidden { display: none !important; }
      .ah-button {
        align-items: center;
        background: #184f61;
        border: 1px solid #123d4a;
        border-radius: 6px;
        color: #fff;
        cursor: pointer;
        display: inline-flex;
        font: 600 13px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
        gap: 6px;
        justify-content: center;
        min-height: 32px;
        padding: 7px 10px;
      }
      .ah-button:hover { background: #216a7e; }
      .ah-button:disabled { cursor: default; opacity: .55; }
      .ah-button-secondary {
        background: #fff;
        border-color: #a8b7bd;
        color: #16343d;
      }
      .ah-button-secondary:hover { background: #eef5f7; }
      .ah-pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
      .ah-toast-layer {
        bottom: 18px;
        display: grid;
        gap: 8px;
        position: fixed;
        right: 18px;
        width: min(360px, calc(100vw - 36px));
        z-index: 2147483647;
      }
      .ah-toast {
        background: #13292f;
        border-left: 4px solid #39a16f;
        border-radius: 6px;
        box-shadow: 0 10px 30px rgba(0,0,0,.24);
        color: #fff;
        font: 13px/1.35 system-ui, -apple-system, Segoe UI, sans-serif;
        padding: 10px 12px;
      }
      .ah-floating-panel {
        background: #fff;
        border: 1px solid #b9c7cc;
        border-radius: 8px;
        box-shadow: 0 12px 36px rgba(24, 54, 63, .2);
        color: #182f36;
        font: 13px/1.35 system-ui, -apple-system, Segoe UI, sans-serif;
        max-width: min(520px, calc(100vw - 32px));
        padding: 12px;
        position: fixed;
        right: 16px;
        top: 84px;
        z-index: 2147483646;
      }
      .ah-floating-panel strong { display: block; font-size: 14px; margin-bottom: 6px; }
      .ah-modal-backdrop {
        align-items: center;
        background: rgba(18, 35, 40, .52);
        display: flex;
        inset: 0;
        justify-content: center;
        position: fixed;
        z-index: 2147483647;
      }
      .ah-modal {
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 18px 54px rgba(0,0,0,.28);
        color: #152d34;
        max-height: min(760px, calc(100vh - 32px));
        overflow: auto;
        padding: 18px;
        width: min(680px, calc(100vw - 32px));
      }
      .ah-modal h2 { font: 700 18px/1.2 system-ui, sans-serif; margin: 0 0 14px; }
      .ah-modal h3 { font: 700 14px/1.2 system-ui, sans-serif; margin: 18px 0 8px; }
      .ah-form-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      .ah-field { display: grid; gap: 4px; }
      .ah-field label { font: 600 12px/1.2 system-ui, sans-serif; }
      .ah-field input, .ah-field select {
        border: 1px solid #aebdc2;
        border-radius: 6px;
        font: 14px/1.2 system-ui, sans-serif;
        min-height: 34px;
        padding: 6px 8px;
      }
      .ah-check { align-items: center; display: flex; gap: 8px; min-height: 30px; }
      .ah-check input { margin: 0; }
      .ah-modal-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: 16px; }
      .ah-ae-row { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
      .ah-ae-total { color: #184f61; font-weight: 700; }
    `;

    if (typeof GM_addStyle === "function") {
      GM_addStyle(css);
      const marker = document.createElement("style");
      marker.id = "ah-shared-styles";
      document.head.append(marker);
      return;
    }
    const style = document.createElement("style");
    style.id = "ah-shared-styles";
    style.textContent = css;
    document.head.append(style);
  }

  ah.ui.styles = { ensureStyles };
})();
