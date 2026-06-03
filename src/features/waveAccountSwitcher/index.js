(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.waveAccountSwitcher = ah.features.waveAccountSwitcher || {};

  const injectedAttr = "data-ah-wave-account-switcher";
  let busy = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function findAccountDropdown(root) {
    const scope = root || document;
    return scope.querySelector(".transactions-list-v2__anchor-transaction__edit__field--account__select") ||
      ah.core.dom.qsa(".wv-select.wv-select--fluid", scope).find((dropdown) => {
        const label = ah.core.dom.text(dropdown.querySelector(".wv-select__label"));
        return /card|account|cash|bank|credit/i.test(label);
      }) ||
      ah.core.dom.findFieldByLabel(scope, ["account", "payment account"]);
  }

  function getCurrentAccount(dropdown) {
    if (!dropdown) return "";
    return ah.core.dom.text(dropdown.querySelector(".wv-select__label")) || dropdown.value || ah.core.dom.text(dropdown);
  }

  function getOpenMenu() {
    return ah.core.dom.visible(ah.core.dom.qsa(".wv-select__menu, [role='listbox']")).at(-1) || null;
  }

  async function openDropdown(dropdown) {
    const already = getOpenMenu();
    if (already) return already;
    const target = dropdown.querySelector(".wv-select__toggle, .wv-select__input") || dropdown;
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    target.click();
    try {
      return await ah.core.dom.waitFor(getOpenMenu, { timeout: 5000, interval: 100 });
    } catch (_error) {
      return null;
    }
  }

  async function selectOption(menu, accountName) {
    const want = String(accountName || "").trim().toLowerCase();
    if (!want || !menu) return false;
    const search = menu.querySelector(".wv-input, input");
    if (search) {
      ah.core.react.setFieldValue(search, accountName);
      await sleep(150);
    }
    const options = ah.core.dom.qsa(".wv-select__menu__option, [role='option'], li, button", menu);
    const option = options.find((item) => ah.core.dom.text(item).trim().toLowerCase() === want) ||
      options.find((item) => {
        const text = ah.core.dom.text(item).trim().toLowerCase();
        return text.includes(want) || want.includes(text);
      });
    if (!option) return false;
    option.click();
    option.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await sleep(300);
    return true;
  }

  async function switchDirect(dropdown, targetAccount) {
    const menu = await openDropdown(dropdown);
    return selectOption(menu, targetAccount);
  }

  function configuredAccounts() {
    return [
      ah.core.settings.get("wave.accounts.amex", ""),
      ah.core.settings.get("wave.accounts.creditCard", "")
    ].filter(Boolean);
  }

  function chooseTarget(current) {
    const accounts = configuredAccounts();
    if (accounts.length < 2) return "";
    const currentLower = current.toLowerCase();
    const currentIndex = accounts.findIndex((account) => {
      const value = account.toLowerCase();
      return currentLower === value || currentLower.includes(value) || value.includes(currentLower);
    });
    return currentIndex === 0 ? accounts[1] : accounts[0];
  }

  async function onSwitch(event) {
    if (busy) return;
    busy = true;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const dropdown = findAccountDropdown(button.closest(".anchor-transaction__line-item--singleline, [role='dialog']") || document);
      const current = getCurrentAccount(dropdown);
      const target = chooseTarget(current);
      if (!dropdown || !target) {
        ah.ui.toast.show("Configure two account switcher options in settings.", { tone: "warn" });
        return;
      }
      const ok = await switchDirect(dropdown, target);
      if (ok) {
        ah.features.waveSavingsDashboard.addClicks(3, "ACCOUNT_SWITCH");
        ah.ui.toast.show("Account switched.");
      } else {
        ah.ui.toast.show("Account option not found.", { tone: "warn" });
      }
    } finally {
      button.disabled = false;
      busy = false;
    }
  }

  function onCapture(event, path) {
    const dropdown = findAccountDropdown(event.currentTarget.closest(".anchor-transaction__line-item--singleline, [role='dialog']") || document);
    const current = getCurrentAccount(dropdown);
    if (!current) {
      ah.ui.toast.show("No current account detected.", { tone: "warn" });
      return;
    }
    ah.core.settings.set(path, current);
    ah.ui.toast.show("Account switcher option saved.");
  }

  function injectNear(dropdown) {
    const target = dropdown.closest(".anchor-transaction__line-item--singleline") || dropdown.parentElement;
    if (!target || target.hasAttribute(injectedAttr)) return;
    target.setAttribute(injectedAttr, "1");
    const row = ah.core.dom.el("div", { class: "ah-pill-row", style: "margin:8px 0 12px;" });
    if (configuredAccounts().length >= 2) {
      row.append(ah.core.dom.el("button", { type: "button", class: "ah-button ah-button-secondary", onclick: onSwitch }, "Switch account"));
    }
    row.append(
      ah.core.dom.el("button", { type: "button", class: "ah-button ah-button-secondary", onclick: (event) => onCapture(event, "wave.accounts.amex") }, "Capture as option A"),
      ah.core.dom.el("button", { type: "button", class: "ah-button ah-button-secondary", onclick: (event) => onCapture(event, "wave.accounts.creditCard") }, "Capture as option B")
    );
    target.insertAdjacentElement("afterend", row);
  }

  function ensure() {
    if (!ah.sites.wave.detect.isWave()) return;
    const dropdowns = ah.core.dom.visible(ah.core.dom.qsa(".transactions-list-v2__anchor-transaction__edit__field--account__select, .wv-select.wv-select--fluid"));
    dropdowns.filter((dropdown) => getCurrentAccount(dropdown)).forEach(injectNear);
  }

  ah.features.waveAccountSwitcher.ensure = ensure;
})();
