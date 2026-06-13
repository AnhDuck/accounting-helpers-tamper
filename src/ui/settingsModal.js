(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.ui = ah.ui || {};

  const tabs = [
    {
      id: "general",
      label: "General",
      kicker: "General settings",
      title: "Wave transaction helpers",
      description: "Defaults and helper behavior used inside Wave transaction screens."
    },
    {
      id: "aliexpress",
      label: "AliExpress",
      kicker: "AliExpress settings",
      title: "Orders, currency, and Wave import",
      description: "AliExpress display settings and controls for staging orders into Wave."
    },
    {
      id: "about",
      label: "About",
      kicker: "Accounting Helpers",
      title: "What this script does",
      description: "Local browser helpers for Wave and AliExpress accounting workflows."
    }
  ];

  const aliExpressFields = [
    {
      path: "aliExpress.defaultCurrency",
      label: "AliExpress source currency",
      title: "Currency shown by AliExpress before conversion helpers run.",
      help: "Default source currency label for AliExpress helper displays."
    },
    {
      path: "aliExpress.targetCurrency",
      label: "Accounting target currency",
      title: "Currency used by accounting helper displays and staged Wave payloads.",
      help: "Target currency label used by converted totals and staged Wave payloads."
    }
  ];

  const waveDefaultFields = [
    {
      path: "wave.defaultAliExpressVendor",
      label: "Default AliExpress vendor",
      title: "Wave vendor/payee to use when filling a staged AliExpress order.",
      help: "Payee value entered when an AliExpress order fills a Wave transaction."
    },
    {
      path: "wave.defaultAliExpressAccount",
      label: "Default Wave account",
      title: "Wave account field value to use for AliExpress transactions.",
      help: "Payment account value entered for staged AliExpress orders."
    },
    {
      path: "wave.defaultAliExpressCategory",
      label: "Default Wave category",
      title: "Wave category field value to use for AliExpress transactions.",
      help: "Category value entered for staged AliExpress orders."
    },
    {
      path: "wave.descriptionPrefix",
      label: "Description prefix",
      title: "Text placed before the AliExpress order ID in the Wave description.",
      help: "Prepended to the order ID when the Wave description is filled."
    }
  ];

  const helperFields = [
    {
      path: "wave.accounts.amex",
      label: "Switch account 1",
      title: "First saved Wave account used by the account switch helper.",
      help: "First account used by the floating Wave account switcher."
    },
    {
      path: "wave.accounts.creditCard",
      label: "Switch account 2",
      title: "Second saved Wave account used by the account switch helper.",
      help: "Second account used by the floating Wave account switcher."
    }
  ];

  const waveHelperChecks = [
    {
      path: "wave.autoUpdateTaxPopover",
      label: "Update visible tax amount after tax changes",
      title: "Keeps the Wave tax popover display aligned after the tax helper changes a transaction.",
      help: "When a GST/PST helper changes tax, also refresh the amount shown in Wave's tax popover."
    },
    {
      path: "wave.markReviewedAutoSave",
      label: "Save after Mark as reviewed",
      title: "Only affects the explicit Mark as reviewed helper button.",
      help: "After the helper marks a transaction as reviewed, click Wave's Save button automatically."
    }
  ];

  const aliToWaveChecks = [
    {
      path: "aliToWave.allowReimport",
      label: "Allow already imported orders to be staged again",
      title: "When off, orders already filled into Wave are disabled on AliExpress.",
      help: "Leave this off during normal use to avoid accidentally filling the same order twice."
    },
    {
      path: "aliToWave.autoFillPending",
      label: "Auto-fill when a Wave transaction modal is open",
      title: "When on, a pending AliExpress order fills the open Wave transaction without pressing Fill.",
      help: "Only runs when Wave already has an edit transaction modal open."
    },
    {
      path: "aliToWave.autoSaveAfterFill",
      label: "Save Wave transaction after every field was filled",
      title: "Wave transactions are not saved automatically unless this is enabled.",
      help: "Only clicks Save when the AliExpress payload filled every required Wave field."
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
    wrapper.append(
      ah.core.dom.el("label", { for: id, title: field.title || "" }, field.label),
      input
    );
    if (field.help) wrapper.append(ah.core.dom.el("div", { class: "ah-help" }, field.help));
    return wrapper;
  }

  function selectFor(path, label, options, title, helpText) {
    const wrapper = ah.core.dom.el("div", { class: "ah-field" });
    const id = `ah-setting-${path.replace(/\W/g, "-")}`;
    const select = ah.core.dom.el("select", { id, "data-setting-path": path, title });
    options.forEach((option) => select.append(ah.core.dom.el("option", { value: option }, option)));
    select.value = ah.core.settings.get(path, options[0]);
    wrapper.append(ah.core.dom.el("label", { for: id, title }, label), select);
    if (helpText) wrapper.append(ah.core.dom.el("div", { class: "ah-help" }, helpText));
    return wrapper;
  }

  function checkFor(item) {
    const id = `ah-setting-${item.path.replace(/\W/g, "-")}`;
    const input = ah.core.dom.el("input", {
      id,
      type: "checkbox",
      "data-setting-path": item.path,
      title: item.title || ""
    });
    input.checked = !!ah.core.settings.get(item.path, false);
    return ah.core.dom.el("label", { class: "ah-setting-check", title: item.title || "" }, [
      input,
      ah.core.dom.el("span", { class: "ah-setting-check-copy" }, [
        ah.core.dom.el("span", { class: "ah-setting-check-title" }, item.label),
        ah.core.dom.el("span", { class: "ah-setting-check-help" }, item.help || item.title || "")
      ])
    ]);
  }

  function help(text) {
    return ah.core.dom.el("div", { class: "ah-help" }, text);
  }

  function section(title, children, description) {
    const node = ah.core.dom.el("section", { class: "ah-settings-section" }, [
      ah.core.dom.el("div", { class: "ah-settings-section-heading" }, [
        ah.core.dom.el("h3", {}, title),
        description ? help(description) : null
      ])
    ]);
    children.filter(Boolean).forEach((child) => node.append(child));
    return node;
  }

  function fieldGrid(fields) {
    const grid = ah.core.dom.el("div", { class: "ah-form-grid" });
    fields.forEach((field) => grid.append(inputFor(field)));
    return grid;
  }

  function checkList(items) {
    const list = ah.core.dom.el("div", { class: "ah-check-list" });
    items.forEach((item) => list.append(checkFor(item)));
    return list;
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
      "Open a Wave edit transaction modal first, then save the current field values into Tampermonkey settings."
    );
  }

  function tabIntro(tab) {
    return ah.core.dom.el("div", { class: "ah-settings-tab-intro" }, [
      ah.core.dom.el("div", { class: "ah-settings-kicker" }, tab.kicker),
      ah.core.dom.el("h2", {}, tab.title),
      ah.core.dom.el("p", {}, tab.description)
    ]);
  }

  function overviewGrid() {
    return ah.core.dom.el("div", { class: "ah-overview-grid" }, [
      ah.core.dom.el("div", { class: "ah-overview-card" }, [
        ah.core.dom.el("strong", {}, "Storage"),
        ah.core.dom.el("span", {}, "Saved locally in Tampermonkey for this browser.")
      ]),
      ah.core.dom.el("div", { class: "ah-overview-card" }, [
        ah.core.dom.el("strong", {}, "Wave"),
        ah.core.dom.el("span", {}, "Fills transaction fields, switches accounts, and assists review/tax actions.")
      ]),
      ah.core.dom.el("div", { class: "ah-overview-card" }, [
        ah.core.dom.el("strong", {}, "AliExpress"),
        ah.core.dom.el("span", {}, "Converts order totals, copies CAD values, and stages orders for Wave.")
      ]),
      ah.core.dom.el("div", { class: "ah-overview-card" }, [
        ah.core.dom.el("strong", {}, "Future tabs"),
        ah.core.dom.el("span", {}, "Add platform-specific settings here without mixing workflows together.")
      ])
    ]);
  }

  function panelFor(tab) {
    const panel = ah.core.dom.el("div", {
      id: `ah-settings-panel-${tab.id}`,
      class: "ah-settings-panel",
      role: "tabpanel",
      "aria-labelledby": `ah-settings-tab-${tab.id}`,
      "data-settings-panel": tab.id
    }, [tabIntro(tab)]);

    if (tab.id === "general") {
      const capture = captureSection();
      panel.append(
        section("Wave defaults for AliExpress orders", [
          fieldGrid(waveDefaultFields),
          selectFor(
            "wave.defaultAliExpressType",
            "Default Wave transaction type",
            ["Withdrawal", "Deposit"],
            "Wave transaction type to use when filling a staged AliExpress order.",
            "Applied when an AliExpress order fills a Wave transaction."
          )
        ], "Values used when a staged AliExpress order fills fields in Wave."),
        section("Wave helper behavior", [
          fieldGrid(helperFields),
          checkList(waveHelperChecks)
        ], "Controls for helper buttons shown inside Wave.")
      );
      if (capture) panel.append(capture);
    }

    if (tab.id === "aliexpress") {
      panel.append(
        section("Currencies", [
          fieldGrid(aliExpressFields)
        ], "Used by AliExpress order total conversion and copy helpers."),
        section("Staging and fill behavior", [
          checkList(aliToWaveChecks)
        ], "Clicking Stage for Wave stores one pending order. If Wave is already open, no duplicate tab is opened.")
      );
    }

    if (tab.id === "about") {
      panel.append(
        section("Overview", [
          overviewGrid()
        ], "Settings are stored locally in Tampermonkey for this browser.")
      );
    }

    return panel;
  }

  function activateTab(modal, tabId) {
    modal.querySelectorAll("[data-settings-tab]").forEach((tab) => {
      const selected = tab.getAttribute("data-settings-tab") === tabId;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    modal.querySelectorAll("[data-settings-panel]").forEach((panel) => {
      const selected = panel.getAttribute("data-settings-panel") === tabId;
      panel.hidden = !selected;
    });
  }

  function sidebarFor(modal) {
    return ah.core.dom.el("nav", { class: "ah-settings-sidebar", "aria-label": "Settings sections" },
      tabs.map((tab) => ah.core.dom.el("button", {
        id: `ah-settings-tab-${tab.id}`,
        type: "button",
        class: "ah-settings-tab",
        role: "tab",
        "aria-selected": "false",
        "aria-controls": `ah-settings-panel-${tab.id}`,
        "data-settings-tab": tab.id,
        onclick: () => activateTab(modal, tab.id)
      }, [
        ah.core.dom.el("span", {}, tab.label)
      ]))
    );
  }

  function open() {
    ah.ui.styles.ensureStyles();
    document.getElementById("ah-settings-modal")?.remove();

    const settings = ah.core.settings.all();
    const backdrop = ah.core.dom.el("div", { id: "ah-settings-modal", class: "ah-modal-backdrop" });
    const modal = ah.core.dom.el("div", { class: "ah-modal ah-settings-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "ah-settings-title" });

    const form = ah.core.dom.el("form", { class: "ah-settings-form" });
    const closeButton = ah.core.dom.el("button", {
      type: "button",
      class: "ah-icon-button",
      title: "Close settings without saving changes.",
      "aria-label": "Close settings",
      onclick: close
    }, "X");

    const header = ah.core.dom.el("div", { class: "ah-settings-header" }, [
      ah.core.dom.el("div", {}, [
        ah.core.dom.el("h1", { id: "ah-settings-title" }, "Settings"),
        ah.core.dom.el("p", {}, "Accounting Helpers")
      ]),
      closeButton
    ]);

    const panels = ah.core.dom.el("div", { class: "ah-settings-panels" }, tabs.map(panelFor));
    const body = ah.core.dom.el("div", { class: "ah-settings-body" });
    body.append(sidebarFor(modal), panels);

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
            ah.ui.toast.show("Settings reset.", { title: "Settings reset" });
          }
        }
      }, "Reset"),
      ah.core.dom.el("button", { type: "submit", class: "ah-button", title: "Save settings to Tampermonkey storage." }, "Save")
    ]);

    form.append(header, body, actions);

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
      ah.ui.toast.show("Settings saved.", { title: "Settings saved" });
    });

    modal.append(form);
    backdrop.append(modal);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    document.body.append(backdrop);
    activateTab(modal, "general");
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
