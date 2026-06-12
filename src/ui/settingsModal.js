(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.ui = ah.ui || {};

  const aliExpressFields = [
    {
      path: "aliExpress.defaultCurrency",
      label: "AliExpress source currency",
      title: "Currency shown by AliExpress before conversion helpers run."
    },
    {
      path: "aliExpress.targetCurrency",
      label: "Accounting target currency",
      title: "Currency used by accounting helper displays and staged Wave payloads."
    }
  ];

  const waveDefaultFields = [
    {
      path: "wave.defaultAliExpressVendor",
      label: "Default AliExpress vendor",
      title: "Wave vendor/payee to use when filling a staged AliExpress order."
    },
    {
      path: "wave.defaultAliExpressAccount",
      label: "Default Wave account",
      title: "Wave account field value to use for AliExpress transactions."
    },
    {
      path: "wave.defaultAliExpressCategory",
      label: "Default Wave category",
      title: "Wave category field value to use for AliExpress transactions."
    },
    {
      path: "wave.descriptionPrefix",
      label: "Description prefix",
      title: "Text placed before the AliExpress order ID in the Wave description."
    }
  ];

  const helperFields = [
    {
      path: "wave.accounts.amex",
      label: "Switch account 1",
      title: "First saved Wave account used by the account switch helper."
    },
    {
      path: "wave.accounts.creditCard",
      label: "Switch account 2",
      title: "Second saved Wave account used by the account switch helper."
    }
  ];

  const aliToWaveChecks = [
    {
      path: "aliToWave.allowReimport",
      label: "Allow staging already imported AliExpress orders",
      title: "When off, orders already filled into Wave are disabled on AliExpress."
    }
  ];

  const helperChecks = [
    {
      path: "wave.autoUpdateTaxPopover",
      label: "When changing Wave tax, also update the visible tax popover amount",
      title: "Keeps the Wave tax popover display aligned after the tax helper changes a transaction."
    },
    {
      path: "wave.markReviewedAutoSave",
      label: "After Mark as reviewed, click Save automatically",
      title: "Only affects the explicit Mark as reviewed helper button."
    },
    {
      path: "aliToWave.autoSaveAfterFill",
      label: "After filling an AliExpress payload, click Save when every field was filled",
      title: "Wave transactions are not saved automatically unless this is enabled."
    }
  ];

  function inputFor(field) {
    const wrapper = ah.core.dom.el("div", { class: "ah-field" });
    const id = `ah-setting-${field.path.replace(/\W/g, "-")}`;
    const input = ah.core.dom.el("input", {
      id,
      type: field.type || "text",
      "data-setting-path": field.path,
      title: field.title || ""
    });
    input.value = ah.core.settings.get(field.path, "");
    wrapper.append(ah.core.dom.el("label", { for: id, title: field.title || "" }, field.label), input);
    if (field.help) wrapper.append(ah.core.dom.el("div", { class: "ah-help" }, field.help));
    return wrapper;
  }

  function selectFor(path, label, options, title) {
    const wrapper = ah.core.dom.el("div", { class: "ah-field" });
    const id = `ah-setting-${path.replace(/\W/g, "-")}`;
    const select = ah.core.dom.el("select", { id, "data-setting-path": path, title });
    options.forEach((option) => select.append(ah.core.dom.el("option", { value: option }, option)));
    select.value = ah.core.settings.get(path, options[0]);
    wrapper.append(ah.core.dom.el("label", { for: id, title }, label), select);
    return wrapper;
  }

  function checkFor(item) {
    const input = ah.core.dom.el("input", { type: "checkbox", "data-setting-path": item.path, title: item.title || "" });
    input.checked = !!ah.core.settings.get(item.path, false);
    return ah.core.dom.el("label", { class: "ah-check", title: item.title || "" }, [
      input,
      ah.core.dom.el("span", {}, item.label)
    ]);
  }

  function help(text) {
    return ah.core.dom.el("div", { class: "ah-help" }, text);
  }

  function section(title, children, description) {
    const node = ah.core.dom.el("section", { class: "ah-settings-section" }, [
      ah.core.dom.el("h3", {}, title)
    ]);
    if (description) node.append(help(description));
    children.filter(Boolean).forEach((child) => node.append(child));
    return node;
  }

  function fieldGrid(fields) {
    const grid = ah.core.dom.el("div", { class: "ah-form-grid" });
    fields.forEach((field) => grid.append(inputFor(field)));
    return grid;
  }

  function checkGrid(items) {
    const grid = ah.core.dom.el("div", { class: "ah-form-grid" });
    items.forEach((item) => grid.append(checkFor(item)));
    return grid;
  }

  function captureButton(label, path, read, title) {
    return ah.core.dom.el("button", {
      type: "button",
      class: "ah-button ah-button-secondary",
      title,
      onclick: () => {
        const value = read();
        if (!value) {
          ah.ui.toast.show("No current Wave value found.", { tone: "warn" });
          return;
        }
        const input = document.querySelector(`[data-setting-path="${CSS.escape(path)}"]`);
        if (input) input.value = value;
        ah.core.settings.set(path, value);
        ah.ui.toast.show(`${label} saved.`);
      }
    }, label);
  }

  function captureSection() {
    if (!ah.sites.wave?.detect?.isWave()) return null;
    const captureRow = ah.core.dom.el("div", { class: "ah-pill-row" }, [
      captureButton("Use current account", "wave.defaultAliExpressAccount", () =>
        ah.sites.wave.transactionModal.readField(["account", "payment account"]),
        "Save the current Wave Account field as the default AliExpress account."
      ),
      captureButton("Save account 1", "wave.accounts.amex", () =>
        ah.sites.wave.transactionModal.readField(["account", "payment account"]),
        "Save the current Wave Account field as switch account 1."
      ),
      captureButton("Save account 2", "wave.accounts.creditCard", () =>
        ah.sites.wave.transactionModal.readField(["account", "payment account"]),
        "Save the current Wave Account field as switch account 2."
      ),
      captureButton("Use current category", "wave.defaultAliExpressCategory", () =>
        ah.sites.wave.transactionModal.readField(["category"]),
        "Save the current Wave Category field as the default AliExpress category."
      ),
      captureButton("Use current vendor", "wave.defaultAliExpressVendor", () =>
        ah.sites.wave.transactionModal.readField(["vendor", "payee", "merchant"]),
        "Save the current Wave Vendor/Payee field as the default AliExpress vendor."
      )
    ]);
    return section(
      "Capture from current Wave transaction",
      [captureRow],
      "Open a Wave edit transaction modal first, then use these buttons to store current field values in Tampermonkey settings."
    );
  }

  function open() {
    ah.ui.styles.ensureStyles();
    document.getElementById("ah-settings-modal")?.remove();

    const settings = ah.core.settings.all();
    const backdrop = ah.core.dom.el("div", { id: "ah-settings-modal", class: "ah-modal-backdrop" });
    const modal = ah.core.dom.el("div", { class: "ah-modal", role: "dialog", "aria-modal": "true" });

    const form = ah.core.dom.el("form", {});

    const actions = ah.core.dom.el("div", { class: "ah-modal-actions" }, [
      ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        title: "Close without saving changes.",
        onclick: close
      }, "Cancel"),
      ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        title: "Clear all Accounting Helpers settings stored by Tampermonkey.",
        onclick: () => {
          if (confirm("Reset Accounting Helpers settings?")) {
            ah.core.settings.reset();
            close();
            ah.ui.toast.show("Settings reset.");
          }
        }
      }, "Reset"),
      ah.core.dom.el("button", { type: "submit", class: "ah-button", title: "Save settings to Tampermonkey storage." }, "Save")
    ]);

    const content = [
      ah.core.dom.el("h2", {}, "Accounting Helpers Settings"),
      section("AliExpress to Wave", [
        help("Clicking Stage for Wave stores one pending AliExpress order. If no recent Wave tab heartbeat is detected, Wave transactions opens automatically; if Wave is already open, no duplicate tab is opened."),
        fieldGrid(aliExpressFields),
        checkGrid(aliToWaveChecks)
      ]),
      section("Wave transaction defaults", [
        fieldGrid(waveDefaultFields),
        selectFor(
          "wave.defaultAliExpressType",
          "Default Wave transaction type",
          ["Withdrawal", "Deposit"],
          "Wave transaction type to use when filling a staged AliExpress order."
        )
      ]),
      section("Wave transaction helpers", [
        fieldGrid(helperFields),
        checkGrid(helperChecks)
      ]),
      captureSection(),
      actions
    ].filter(Boolean);
    form.append(...content);

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
