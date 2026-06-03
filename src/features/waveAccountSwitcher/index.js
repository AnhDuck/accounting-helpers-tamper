(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.waveAccountSwitcher = ah.features.waveAccountSwitcher || {};

  const injectedAttr = "data-ah-wave-account-switcher";
  const accountDropdownSelector = ".transactions-list-v2__anchor-transaction__edit__field--account__select";
  let busy = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function findAccountDropdown(root) {
    const scope = root || document;
    return ah.core.dom.visible(ah.core.dom.qsa(`${accountDropdownSelector}, .wv-select.wv-select--fluid, [role='combobox']`, scope))
      .find(isAccountDropdown) ||
      ah.core.dom.findFieldByLabel(scope, ["account", "payment account"]);
  }

  function hasAccountLabel(text) {
    return /^(account|payment account)\b/i.test(String(text || "").trim());
  }

  function isAccountDropdown(dropdown) {
    if (!dropdown) return false;
    if (dropdown.matches(accountDropdownSelector)) return true;
    const aria = dropdown.getAttribute("aria-label") || dropdown.getAttribute("name") || dropdown.getAttribute("data-testid");
    if (hasAccountLabel(aria)) return true;

    let node = dropdown;
    for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
      const label = node.querySelector?.("label");
      if (label && !dropdown.contains(label) && hasAccountLabel(ah.core.dom.text(label))) return true;

      const siblings = Array.from(node.parentElement?.children || []);
      const index = siblings.indexOf(node);
      const previousText = siblings.slice(0, Math.max(0, index)).reverse()
        .map((item) => ah.core.dom.text(item))
        .find(Boolean);
      if (hasAccountLabel(previousText)) return true;

      const fieldText = ah.core.dom.text(node);
      if (hasAccountLabel(fieldText) && fieldText.length < 120) return true;
    }
    return false;
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
        ah.ui.toast.show("Configure Account 1 and Account 2 in settings.", { tone: "warn" });
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

  function injectNear(dropdown) {
    const target = dropdown.closest(".anchor-transaction__line-item--singleline") || dropdown.parentElement;
    if (!target || target.hasAttribute(injectedAttr)) return;
    const row = ah.core.dom.el("div", { class: "ah-pill-row", style: "margin:8px 0 12px;" });
    if (configuredAccounts().length >= 2) {
      row.append(ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        title: "Switch between Account 1 and Account 2 saved in local Tampermonkey settings.",
        onclick: onSwitch
      }, "Switch account"));
    }
    if (!row.childElementCount) return;
    target.setAttribute(injectedAttr, "1");
    target.insertAdjacentElement("afterend", row);
  }

  function ensure() {
    if (!ah.sites.wave.detect.isWave()) return;
    const dropdowns = ah.core.dom.visible(ah.core.dom.qsa(`${accountDropdownSelector}, .wv-select.wv-select--fluid, [role='combobox']`));
    dropdowns.filter((dropdown) => isAccountDropdown(dropdown) && getCurrentAccount(dropdown)).forEach(injectNear);
  }

  ah.features.waveAccountSwitcher.ensure = ensure;
})();
