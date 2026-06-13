(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.waveTaxButtons = ah.features.waveTaxButtons || {};

  const TAX_GST = "GST (5%)";
  const TAX_PST = "PST (7%)";
  const wrapUidAttr = "data-ah-wave-tax-wrapuid";
  const injectedAttr = "data-ah-wave-tax-injected";
  const rowClass = "ah-wave-tax-row";
  let uid = 1;
  let busy = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function textIncludes(node, needle) {
    return ah.core.dom.text(node).toLowerCase().includes(String(needle).toLowerCase());
  }

  function getOpenPopover() {
    return ah.core.dom.visible(ah.core.dom.qsa(".transaction-tax-liability__popover-content[role='dialog']")).at(-1) || null;
  }

  function getTaxRows(popover) {
    return popover ? ah.core.dom.qsa(".transaction-tax-liability__content__taxes__tax", popover) : [];
  }

  function getRowLabel(row) {
    const label = row.querySelector("button.wv-select__toggle .wv-select__label, .wv-select__label");
    return ah.core.dom.text(label);
  }

  function getSelectedTaxes(popover) {
    return getTaxRows(popover)
      .map(getRowLabel)
      .filter((tax) => tax && !/^select a sales tax/i.test(tax));
  }

  function findEmptyRowIndex(popover) {
    return getTaxRows(popover).findIndex((row) => /^select a sales tax/i.test(getRowLabel(row)));
  }

  async function openPopoverFromWrapper(wrapper) {
    const open = getOpenPopover();
    if (open) return open;
    const toggle = ah.core.dom.qsa("button.transaction-tax-liability__popover-toggle", wrapper)
      .find((button) => textIncludes(button, "Include sales tax") || textIncludes(button, "Edit"));
    if (!toggle) return null;
    toggle.click();
    try {
      return await ah.core.dom.waitFor(getOpenPopover, { timeout: 8000, interval: 50 });
    } catch (_error) {
      return null;
    }
  }

  async function waitUntilSelectedContains(taxText) {
    const want = taxText.trim().toLowerCase();
    try {
      await ah.core.dom.waitFor(() => {
        const popover = getOpenPopover();
        return popover && getSelectedTaxes(popover).some((tax) => tax.trim().toLowerCase() === want);
      }, { timeout: 8000, interval: 50 });
      return true;
    } catch (_error) {
      return false;
    }
  }

  async function setTaxInRowIndex(rowIndex, taxText) {
    const popover = getOpenPopover();
    const row = getTaxRows(popover)[rowIndex];
    if (!row) return false;
    const hiddenSelect = row.querySelector('div[data-testid="hidden-select-container"] select, select');
    if (!hiddenSelect) return false;
    const want = taxText.trim().toLowerCase();
    const option = Array.from(hiddenSelect.options).find((item) =>
      ah.core.dom.text(item).trim().toLowerCase() === want
    ) || Array.from(hiddenSelect.options).find((item) =>
      ah.core.dom.text(item).trim().toLowerCase().includes(want)
    );
    if (!option) return false;
    if (hiddenSelect.value !== option.value) {
      hiddenSelect.value = option.value;
      hiddenSelect.dispatchEvent(new Event("input", { bubbles: true }));
      hiddenSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return waitUntilSelectedContains(taxText);
  }

  async function ensureTaxPresent(wrapper, taxText) {
    let popover = await openPopoverFromWrapper(wrapper);
    if (!popover) return false;
    const want = taxText.trim().toLowerCase();
    if (getSelectedTaxes(popover).some((tax) => tax.trim().toLowerCase() === want)) return true;

    if (getSelectedTaxes(popover).length === 0) return setTaxInRowIndex(0, taxText);

    let emptyIndex = findEmptyRowIndex(popover);
    if (emptyIndex >= 0) return setTaxInRowIndex(emptyIndex, taxText);

    const applyAnother = ah.core.dom.qsa("button, [role='button']", popover)
      .find((button) => textIncludes(button, "Apply another tax"));
    if (applyAnother) {
      applyAnother.click();
      await sleep(900);
      popover = getOpenPopover();
      emptyIndex = findEmptyRowIndex(popover);
      return setTaxInRowIndex(emptyIndex >= 0 ? emptyIndex : getTaxRows(popover).length - 1, taxText);
    }

    return setTaxInRowIndex(0, taxText);
  }

  function clickUpdateIfEnabled() {
    if (!ah.core.settings.get("wave.autoUpdateTaxPopover", false)) return;
    const popover = getOpenPopover();
    const update = popover?.querySelector('[data-testid="popover-actions"] button.wv-button--primary') ||
      ah.core.dom.findByText(popover || document, "button, [role='button']", "Update");
    update?.click?.();
  }

  function findWrapperForButton(button) {
    const id = button.dataset.wrapuid;
    if (!id) return null;
    return document.querySelector(`[${wrapUidAttr}="${CSS.escape(id)}"]`);
  }

  async function applyTax(event, taxText) {
    if (busy) {
      ah.ui.toast.show("Wave helper is busy.", { tone: "warn" });
      return;
    }
    busy = true;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const wrapper = findWrapperForButton(button);
      const ok = wrapper && await ensureTaxPresent(wrapper, taxText);
      if (!ok) {
        ah.ui.toast.show(`Failed to apply ${taxText}.`, { tone: "warn" });
        return;
      }
      ah.features.waveSavingsDashboard.addClicks(3, taxText === TAX_GST ? "GST" : "PST");
      ah.ui.toast.show(`Applied ${taxText}.`);
      await sleep(120);
      clickUpdateIfEnabled();
    } catch (error) {
      ah.core.logger.error("Tax button failed", String(error));
      ah.ui.toast.show(`Error applying ${taxText}.`, { tone: "error" });
    } finally {
      button.disabled = false;
      busy = false;
    }
  }

  async function applyBoth(event) {
    if (busy) {
      ah.ui.toast.show("Wave helper is busy.", { tone: "warn" });
      return;
    }
    busy = true;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const wrapper = findWrapperForButton(button);
      if (!wrapper) throw new Error("wrapper missing");
      const gst = await ensureTaxPresent(wrapper, TAX_GST);
      await sleep(350);
      const pst = await ensureTaxPresent(wrapper, TAX_PST);
      if (!gst || !pst) {
        ah.ui.toast.show("Failed to apply GST + PST.", { tone: "warn" });
        return;
      }
      ah.features.waveSavingsDashboard.addClicks(6, "COMBO");
      ah.ui.toast.show("Applied GST + PST.");
      await sleep(120);
      clickUpdateIfEnabled();
    } catch (error) {
      ah.core.logger.error("Tax combo failed", String(error));
      ah.ui.toast.show("Error applying GST + PST.", { tone: "error" });
    } finally {
      button.disabled = false;
      busy = false;
    }
  }

  function makeButton(label, onClick, tone) {
    return ah.core.dom.el("button", {
      type: "button",
      class: `ah-button ${tone === "danger" ? "" : "ah-button-secondary"}`,
      style: tone === "danger" ? "background:#b43232;border-color:#922929;" : "",
      onclick: (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick(event);
      }
    }, label);
  }

  function ensureWrapperUid(wrapper) {
    let id = wrapper.getAttribute(wrapUidAttr);
    if (!id) {
      id = String(uid++);
      wrapper.setAttribute(wrapUidAttr, id);
    }
    return id;
  }

  function injectButtons(wrapper) {
    const id = ensureWrapperUid(wrapper);
    if (document.querySelector(`.${rowClass}[data-wrapuid="${CSS.escape(id)}"]`)) return;
    const row = ah.core.dom.el("div", { class: rowClass, "data-wrapuid": id, style: "display:block;width:100%;margin:8px 0 16px;" });
    const inner = ah.core.dom.el("span", { class: "ah-pill-row" });
    const gst = makeButton("Apply GST", (event) => applyTax(event, TAX_GST));
    const pst = makeButton("Apply PST", (event) => applyTax(event, TAX_PST));
    const both = makeButton("Apply GST + PST", applyBoth, "danger");
    [gst, pst, both].forEach((button) => { button.dataset.wrapuid = id; inner.append(button); });
    row.append(inner);
    wrapper.insertAdjacentElement("afterend", row);
  }

  function ensurePanelToggle() {
    const panel = document.getElementById("ah-wave-panel");
    if (!panel || panel.querySelector("[data-ah-auto-update]")) return;
    const checkbox = ah.core.dom.el("input", { type: "checkbox", "data-ah-auto-update": "1" });
    checkbox.checked = ah.core.settings.get("wave.autoUpdateTaxPopover", false);
    checkbox.addEventListener("change", () => {
      ah.core.settings.set("wave.autoUpdateTaxPopover", checkbox.checked, { source: "settings-modal" });
      ah.ui.toast.show(`Auto Update ${checkbox.checked ? "ON" : "OFF"}.`);
    });
    panel.append(ah.core.dom.el("label", { class: "ah-check", style: "white-space:nowrap;" }, [checkbox, "Auto Update"]));
  }

  function ensure() {
    if (!ah.sites.wave.detect.isWave()) return;
    ah.features.waveSavingsDashboard.ensure();
    ensurePanelToggle();
    const wrappers = ah.core.dom.qsa(`.anchor-transaction__line-item--singleline__btn-wrapper:not([${injectedAttr}])`);
    wrappers.forEach((wrapper) => {
      wrapper.setAttribute(injectedAttr, "1");
      const hasTaxToggle = ah.core.dom.qsa("button.transaction-tax-liability__popover-toggle", wrapper)
        .some((button) => textIncludes(button, "Include sales tax") || textIncludes(button, "Edit"));
      if (hasTaxToggle) injectButtons(wrapper);
    });
  }

  ah.features.waveTaxButtons.ensure = ensure;
})();
