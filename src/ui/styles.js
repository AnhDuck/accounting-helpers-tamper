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
        background: #f1f4f5;
        border-color: #a8b7bd;
        color: #16343d;
      }
      .ah-button-secondary:hover { background: #e3eaed; }
      .ah-icon-button {
        align-items: center;
        background: #f2f5f6;
        border: 1px solid #c6d1d5;
        border-radius: 6px;
        color: #243d45;
        cursor: pointer;
        display: inline-flex;
        font: 700 18px/1 system-ui, -apple-system, Segoe UI, sans-serif;
        height: 40px;
        justify-content: center;
        width: 40px;
      }
      .ah-icon-button:hover { background: #e5ecef; }
      .ah-pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
      .ah-toast-layer {
        bottom: 18px;
        display: grid;
        gap: 10px;
        position: fixed;
        right: 18px;
        width: min(460px, calc(100vw - 36px));
        z-index: 2147483647;
      }
      .ah-toast {
        align-items: start;
        background: #102b31;
        border: 1px solid rgba(255,255,255,.12);
        border-left: 5px solid #38a16f;
        border-radius: 8px;
        box-shadow: 0 12px 34px rgba(0,0,0,.28);
        color: #fff;
        display: grid;
        font: 13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
        gap: 10px;
        grid-template-columns: 28px 1fr;
        padding: 12px 14px;
      }
      .ah-toast-icon {
        align-items: center;
        background: rgba(255,255,255,.12);
        border-radius: 50%;
        display: inline-flex;
        font: 800 14px/1 system-ui, sans-serif;
        height: 28px;
        justify-content: center;
        margin-top: 1px;
        width: 28px;
      }
      .ah-toast-icon::before { content: "OK"; font-size: 10px; }
      .ah-toast-warn { border-left-color: #d79a2b; }
      .ah-toast-warn .ah-toast-icon::before { content: "!"; font-size: 15px; }
      .ah-toast-error { border-left-color: #d85a4a; }
      .ah-toast-error .ah-toast-icon::before { content: "X"; font-size: 13px; }
      .ah-toast-copy { min-width: 0; }
      .ah-toast-title {
        display: block;
        font: 800 14px/1.25 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 0 0 3px;
      }
      .ah-toast-body {
        color: #e9f2f4;
        overflow-wrap: anywhere;
        white-space: normal;
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
      .ah-ali-to-wave-modal-actions {
        align-items: center;
        background: #f6fafb;
        border: 1px solid #b9c7cc;
        border-radius: 6px;
        color: #182f36;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0 0 12px;
        padding: 10px;
      }
      .ah-ali-to-wave-modal-actions strong { font-size: 13px; margin-right: 4px; }
      .ah-ali-to-wave-modal-actions span { color: #3d5961; font-weight: 600; margin-right: auto; }
      .ah-modal-backdrop {
        align-items: center;
        background: rgba(18, 35, 40, .52);
        display: flex;
        inset: 0;
        justify-content: center;
        padding: 12px;
        position: fixed;
        z-index: 2147483647;
      }
      .ah-modal {
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 18px 54px rgba(0,0,0,.28);
        color: #152d34;
        max-height: min(820px, calc(100vh - 32px));
        overflow: auto;
        width: min(680px, calc(100vw - 32px));
      }
      .ah-settings-modal {
        display: grid;
        height: min(984px, calc(100vh - 24px));
        max-height: calc(100vh - 24px);
        overflow: hidden;
        padding: 0;
        width: min(1120px, calc(100vw - 24px));
      }
      .ah-settings-form {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        height: 100%;
        min-height: 0;
      }
      .ah-settings-header {
        align-items: center;
        background: #fbfdfd;
        border-bottom: 1px solid #c6d4d9;
        display: flex;
        gap: 16px;
        justify-content: space-between;
        padding: 18px 22px;
      }
      .ah-settings-header h1 {
        font: 800 22px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 0;
      }
      .ah-settings-header p {
        color: #60747a;
        font: 600 12px/1.3 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 4px 0 0;
      }
      .ah-settings-body {
        background: #f7fafb;
        display: grid;
        grid-template-columns: 216px minmax(0, 1fr);
        min-height: 0;
      }
      .ah-settings-sidebar {
        background: #e9eff2;
        border-right: 1px solid #c6d4d9;
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow: auto;
        padding: 18px 10px;
      }
      .ah-settings-tab {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: 6px;
        color: #29454d;
        cursor: pointer;
        display: flex;
        font: 800 14px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
        min-height: 44px;
        padding: 10px 12px;
        text-align: left;
        width: 100%;
      }
      .ah-settings-tab:hover { background: #dce7eb; color: #132f37; }
      .ah-settings-tab.is-active {
        background: #173f4b;
        color: #fff;
      }
      .ah-settings-panels {
        background: #fff;
        min-width: 0;
        overflow: auto;
        padding: 24px 30px 30px;
      }
      .ah-settings-panel[hidden] { display: none !important; }
      .ah-settings-tab-intro {
        border-bottom: 1px solid #dfe7ea;
        margin: 0 0 20px;
        padding: 0 0 18px;
      }
      .ah-settings-kicker {
        color: #41616b;
        font: 800 12px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 0 0 6px;
        text-transform: uppercase;
      }
      .ah-settings-tab-intro h2 {
        font: 800 20px/1.25 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 0 0 8px;
      }
      .ah-settings-tab-intro p {
        color: #4d646b;
        font: 13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 0;
        max-width: 760px;
      }
      .ah-settings-section {
        background: #fff;
        border: 1px solid #cbd9de;
        border-radius: 8px;
        margin: 0 0 16px;
        overflow: hidden;
      }
      .ah-settings-section-heading {
        background: #eef5f7;
        border-bottom: 1px solid #cbd9de;
        padding: 14px 16px 12px;
      }
      .ah-settings-section h3 {
        font: 800 15px/1.25 system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 0 0 5px;
      }
      .ah-settings-section > .ah-form-grid,
      .ah-settings-section > .ah-check-list,
      .ah-settings-section > .ah-pill-row,
      .ah-settings-section > .ah-overview-grid,
      .ah-settings-section > .ah-settings-data-tools,
      .ah-settings-section > .ah-settings-warning {
        margin: 16px;
      }
      .ah-help { color: #5b7077; font: 12px/1.4 system-ui, sans-serif; margin: 0; }
      .ah-form-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
      .ah-field { display: grid; gap: 6px; min-width: 0; }
      .ah-field label { font: 750 12px/1.25 system-ui, sans-serif; }
      .ah-field input, .ah-field select {
        border: 1px solid #aebdc2;
        box-sizing: border-box;
        border-radius: 6px;
        font: 14px/1.35 system-ui, sans-serif;
        min-height: 44px;
        min-width: 0;
        padding: 10px 12px;
        width: 100%;
      }
      .ah-field select { padding-right: 36px; }
      .ah-field input:focus, .ah-field select:focus {
        border-color: #2b7388;
        box-shadow: 0 0 0 3px rgba(43, 115, 136, .16);
        outline: none;
      }
      .ah-check-list {
        display: grid;
        gap: 10px;
      }
      .ah-setting-check {
        align-items: start;
        background: #fff;
        border: 1px solid #cbd9de;
        border-radius: 8px;
        cursor: pointer;
        display: grid;
        gap: 10px;
        grid-template-columns: auto 1fr;
        margin: 0;
        padding: 12px;
      }
      .ah-setting-check:hover { background: #f5fafb; border-color: #9fb5bd; }
      .ah-setting-check input {
        margin: 2px 0 0;
      }
      .ah-setting-check-copy {
        display: grid;
        gap: 3px;
        min-width: 0;
      }
      .ah-setting-check-title {
        color: #182f36;
        font: 750 13px/1.25 system-ui, -apple-system, Segoe UI, sans-serif;
      }
      .ah-setting-check-help {
        color: #60747a;
        font: 12px/1.4 system-ui, -apple-system, Segoe UI, sans-serif;
      }
      .ah-overview-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .ah-overview-card {
        background: #fff;
        border: 1px solid #cbd9de;
        border-radius: 8px;
        display: grid;
        gap: 5px;
        padding: 12px;
      }
      .ah-overview-card strong {
        color: #182f36;
        font: 800 13px/1.2 system-ui, sans-serif;
      }
      .ah-overview-card span {
        color: #60747a;
        font: 12px/1.4 system-ui, sans-serif;
      }
      .ah-status-warn {
        border-color: #d79a2b;
        background: #fffaf0;
      }
      .ah-settings-warning {
        background: #fff7ed;
        border: 1px solid #d79a2b;
        border-radius: 8px;
        color: #6b3a05;
        display: grid;
        font: 12px/1.45 system-ui, sans-serif;
        gap: 4px;
        padding: 10px 12px;
      }
      .ah-settings-data-tools {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ah-settings-data-stack {
        display: grid;
      }
      .ah-settings-import {
        border: 1px solid #aebdc2;
        border-radius: 8px;
        box-sizing: border-box;
        color: #172f37;
        font: 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
        min-height: 160px;
        padding: 12px;
        resize: vertical;
        width: 100%;
      }
      .ah-check { align-items: center; display: flex; gap: 8px; min-height: 30px; }
      .ah-check input { margin: 0; }
      .ah-modal-actions {
        align-items: center;
        background: #fbfdfd;
        border-top: 1px solid #c6d4d9;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
        padding: 14px 18px;
      }
      .ah-ae-row { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
      .ah-ae-total { color: #184f61; font-weight: 700; }
      .ah-amz-order-row {
        align-items: center;
        background: #f6fafb;
        border: 1px solid #cbd9de;
        border-radius: 6px;
        box-sizing: border-box;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 10px 0;
        padding: 10px;
        width: 100%;
      }
      .ah-amz-order-row .ah-button { min-height: 30px; }
      .ah-amz-title-line {
        box-sizing: border-box;
        min-height: 30px;
        padding-left: 88px;
        position: relative;
      }
      .ah-amz-title-line .ah-amz-copy-title {
        left: 0;
        min-height: 28px;
        padding: 5px 9px;
        position: absolute;
        top: 0;
        width: auto;
      }
      .ah-amz-open-invoice {
        background: #dcf7e7;
        border-color: #8bc7a0;
        color: #17442a;
      }
      .ah-amz-open-invoice:hover { background: #c9f0da; }
      .ah-amz-apply-wave {
        background: #b43232;
        border-color: #922929;
        color: #fff;
      }
      .ah-amz-apply-wave:hover { background: #9f2d2d; }
      .ah-amz-download-invoice {
        background: #fde2e2;
        border-color: #e5a1a1;
        color: #6f1d1d;
      }
      .ah-amz-download-invoice:hover { background: #fbd0d0; }
      .ah-amz-invoice-note {
        color: #5b7077;
        font: 12px/1.35 system-ui, sans-serif;
      }
      .ah-amazon-to-wave-modal-actions {
        align-items: start;
        background: #f6fafb;
        border: 1px solid #b9c7cc;
        border-radius: 6px;
        color: #182f36;
        display: grid;
        gap: 8px;
        grid-template-columns: minmax(0, 1fr) auto;
        margin: 0 0 12px;
        padding: 10px;
      }
      .ah-amz-pending-card { display: grid; gap: 8px; }
      .ah-amz-pending-summary {
        display: grid;
        gap: 4px;
        min-width: 0;
      }
      .ah-amz-pending-kicker {
        color: #47616a;
        font: 750 11px/1.2 system-ui, sans-serif;
        text-transform: uppercase;
      }
      .ah-amz-pending-main {
        align-items: baseline;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .ah-amz-pending-main strong {
        color: #142f37;
        font: 800 14px/1.25 system-ui, sans-serif;
      }
      .ah-amz-pending-amount {
        color: #294c55;
        font: 800 14px/1.25 system-ui, sans-serif;
      }
      .ah-amz-pending-product {
        color: #3f5961;
        font: 12px/1.35 system-ui, sans-serif;
        overflow-wrap: anywhere;
      }
      .ah-amz-pending-actions {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ah-amazon-to-wave-modal-actions .ah-amz-pending-actions {
        justify-content: flex-end;
        min-width: 360px;
      }
      @media (max-width: 760px) {
        .ah-amazon-to-wave-modal-actions {
          grid-template-columns: 1fr;
        }
        .ah-amazon-to-wave-modal-actions .ah-amz-pending-actions {
          justify-content: flex-start;
          min-width: 0;
        }
      }
      #ah-diagnostics-panel {
        bottom: var(--ah-dev-status-offset, 84px);
        left: 12px;
        position: fixed;
        z-index: 2147483647;
      }
      .ah-diagnostics-modal {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        max-height: calc(100vh - 24px);
        width: min(980px, calc(100vw - 24px));
      }
      .ah-diagnostics-body {
        display: grid;
        gap: 12px;
        min-height: 0;
        overflow: auto;
        padding: 16px;
      }
      .ah-diagnostics-report {
        display: grid;
        gap: 12px;
        min-height: 0;
      }
      .ah-diagnostics-summary {
        background: #f6fafb;
        border: 1px solid #cbd9de;
        border-radius: 8px;
        color: #203b43;
        display: grid;
        font: 12px/1.45 system-ui, sans-serif;
        gap: 4px;
        padding: 10px 12px;
      }
      .ah-diagnostics-output {
        border: 1px solid #aebdc2;
        border-radius: 8px;
        box-sizing: border-box;
        color: #172f37;
        font: 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
        min-height: 360px;
        padding: 12px;
        resize: vertical;
        width: 100%;
      }
      @media (max-width: 760px) {
        .ah-modal-backdrop { align-items: stretch; padding: 8px; }
        .ah-settings-modal { height: calc(100vh - 16px); width: calc(100vw - 16px); }
        .ah-settings-header { padding: 14px; }
        .ah-settings-body {
          grid-template-columns: 1fr;
          grid-template-rows: auto minmax(0, 1fr);
        }
        .ah-settings-sidebar {
          border-bottom: 1px solid #d7e0e3;
          border-right: 0;
          flex-direction: row;
          padding: 10px;
        }
        .ah-settings-tab {
          flex: 0 0 auto;
          min-width: 118px;
        }
        .ah-settings-panels { padding: 16px; }
        .ah-form-grid { grid-template-columns: 1fr; }
      }
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
