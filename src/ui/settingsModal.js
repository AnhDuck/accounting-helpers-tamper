(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.ui = ah.ui || {};

  const fields = [
    ["wave.defaultAliExpressVendor", "Default Wave vendor", "text"],
    ["wave.defaultAliExpressAccount", "Default Wave account", "text"],
    ["wave.defaultAliExpressCategory", "Default Wave category", "text"],
    ["wave.descriptionPrefix", "AliExpress description prefix", "text"],
    ["wave.accounts.amex", "Account switcher option A", "text"],
    ["wave.accounts.creditCard", "Account switcher option B", "text"],
    ["aliExpress.defaultCurrency", "AliExpress source currency", "text"],
    ["aliExpress.targetCurrency", "Accounting target currency", "text"]
  ];

  const checks = [
    ["wave.autoUpdateTaxPopover", "Auto update Wave tax popover"],
    ["wave.markReviewedAutoSave", "Mark reviewed auto-save"],
    ["aliToWave.autoOpenWave", "Open Wave after Send to Wave"],
    ["aliToWave.autoFillPending", "Auto-fill pending payload when a Wave modal is open"],
    ["aliToWave.autoSaveAfterFill", "Auto-save after AliExpress import"],
    ["aliToWave.allowReimport", "Allow re-import of already imported AliExpress orders"]
  ];

  function inputFor(path, label, type) {
    const wrapper = ah.core.dom.el("div", { class: "ah-field" });
    const id = `ah-setting-${path.replace(/\W/g, "-")}`;
    const input = ah.core.dom.el("input", { id, type: type || "text", "data-setting-path": path });
    input.value = ah.core.settings.get(path, "");
    wrapper.append(ah.core.dom.el("label", { for: id }, label), input);
    return wrapper;
  }

  function selectFor(path, label, options) {
    const wrapper = ah.core.dom.el("div", { class: "ah-field" });
    const id = `ah-setting-${path.replace(/\W/g, "-")}`;
    const select = ah.core.dom.el("select", { id, "data-setting-path": path });
    options.forEach((option) => select.append(ah.core.dom.el("option", { value: option }, option)));
    select.value = ah.core.settings.get(path, options[0]);
    wrapper.append(ah.core.dom.el("label", { for: id }, label), select);
    return wrapper;
  }

  function checkFor(path, label) {
    const input = ah.core.dom.el("input", { type: "checkbox", "data-setting-path": path });
    input.checked = !!ah.core.settings.get(path, false);
    const wrapper = ah.core.dom.el("label", { class: "ah-check" }, [input, ah.core.dom.el("span", {}, label)]);
    return wrapper;
  }

  function captureButton(label, path, read) {
    return ah.core.dom.el("button", {
      type: "button",
      class: "ah-button ah-button-secondary",
      onclick: () => {
        const value = read();
        if (!value) {
          ah.ui.toast.show("No current Wave value found.", { tone: "warn" });
          return;
        }
        const input = document.querySelector(`[data-setting-path="${CSS.escape(path)}"]`);
        if (input) input.value = value;
        ah.core.settings.set(path, value);
        ah.ui.toast.show("Saved current Wave value.");
      }
    }, label);
  }

  function open() {
    ah.ui.styles.ensureStyles();
    document.getElementById("ah-settings-modal")?.remove();

    const settings = ah.core.settings.all();
    const backdrop = ah.core.dom.el("div", { id: "ah-settings-modal", class: "ah-modal-backdrop" });
    const modal = ah.core.dom.el("div", { class: "ah-modal", role: "dialog", "aria-modal": "true" });

    const form = ah.core.dom.el("form", {});
    const grid = ah.core.dom.el("div", { class: "ah-form-grid" });
    fields.forEach(([path, label, type]) => grid.append(inputFor(path, label, type)));
    grid.append(selectFor("wave.defaultAliExpressType", "Default Wave transaction type", ["Withdrawal", "Deposit"]));

    const checkGrid = ah.core.dom.el("div", { class: "ah-form-grid" });
    checks.forEach(([path, label]) => checkGrid.append(checkFor(path, label)));

    const captureRow = ah.core.dom.el("div", { class: "ah-pill-row" });
    if (ah.sites.wave?.detect?.isWave()) {
      captureRow.append(
        captureButton("Use current account", "wave.defaultAliExpressAccount", () =>
          ah.sites.wave.transactionModal.readField(["account", "payment account"])
        ),
        captureButton("Use current category", "wave.defaultAliExpressCategory", () =>
          ah.sites.wave.transactionModal.readField(["category"])
        ),
        captureButton("Use current vendor", "wave.defaultAliExpressVendor", () =>
          ah.sites.wave.transactionModal.readField(["vendor", "payee", "merchant"])
        )
      );
    }

    const actions = ah.core.dom.el("div", { class: "ah-modal-actions" }, [
      ah.core.dom.el("button", { type: "button", class: "ah-button ah-button-secondary", onclick: close }, "Cancel"),
      ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        onclick: () => {
          if (confirm("Reset Accounting Helpers settings?")) {
            ah.core.settings.reset();
            close();
            ah.ui.toast.show("Settings reset.");
          }
        }
      }, "Reset"),
      ah.core.dom.el("button", { type: "submit", class: "ah-button" }, "Save")
    ]);

    form.append(
      ah.core.dom.el("h2", {}, "Accounting Helpers Settings"),
      ah.core.dom.el("h3", {}, "Wave and AliExpress defaults"),
      grid,
      ah.core.dom.el("h3", {}, "Automation"),
      checkGrid
    );
    if (captureRow.childElementCount) {
      form.append(ah.core.dom.el("h3", {}, "Capture from current Wave transaction"), captureRow);
    }
    form.append(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = settings;
      form.querySelectorAll("[data-setting-path]").forEach((input) => {
        const path = input.getAttribute("data-setting-path");
        const value = input.type === "checkbox" ? input.checked : input.value;
        const parts = path.split(".");
        let current = next;
        parts.slice(0, -1).forEach((part) => {
          current[part] = current[part] || {};
          current = current[part];
        });
        current[parts.at(-1)] = value;
      });
      ah.core.settings.save(next);
      close();
      ah.ui.toast.show("Settings saved.");
    });

    modal.append(form);
    backdrop.append(modal);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    document.body.append(backdrop);
  }

  function close() {
    document.getElementById("ah-settings-modal")?.remove();
  }

  function registerMenuCommand() {
    if (registerMenuCommand.done) return;
    registerMenuCommand.done = true;
    if (typeof GM_registerMenuCommand === "function") {
      GM_registerMenuCommand("Accounting Helpers: Open Settings", open);
    }
  }

  ah.ui.settingsModal = { open, close, registerMenuCommand };
})();
