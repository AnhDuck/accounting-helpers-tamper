(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.aliexpressCartPerUnit = ah.features.aliexpressCartPerUnit || {};

  const summaryItemSelector = ".cart-summary-item-wrapStyle";
  const summaryLabelSelector = ".cart-summary-item-wrapStyle-label";
  const summaryContentSelector = ".cart-summary-item-wrapStyle-content";
  const chosenItemSelector = ".cart-summary-chosenCartLines-item";
  const productSelector = ".cart-product";
  const productImageSelector = ".cart-product-img";
  const quantityInputSelector = '.comet-v2-input-number-input[aria-label="number"]';
  const rowClass = "ah-ae-per-unit-row";
  let updateTimer = null;
  let installed = false;

  function parseCurrencyAmount(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    const match = normalized.match(/(-?[\d,.]+)/);
    if (!match) return null;
    const amount = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(amount)) return null;
    return { amount, currency: normalized.replace(match[1], "").replace(/\s+/g, " ").trim() };
  }

  function backgroundImageUrl(element) {
    const style = element?.style?.backgroundImage || "";
    const match = style.match(/url\(["']?(.*?)["']?\)/i);
    return match ? match[1] : null;
  }

  function findEstimatedTotalRow() {
    return ah.core.dom.qsa(summaryLabelSelector).find((label) =>
      ah.core.dom.text(label).toLowerCase() === "estimated total"
    )?.closest(summaryItemSelector) || null;
  }

  function ensurePerUnitRow() {
    const estimatedRow = findEstimatedTotalRow();
    if (!estimatedRow) return null;
    let row = estimatedRow.nextElementSibling;
    if (!row || !row.classList.contains(rowClass)) {
      row = ah.core.dom.el("div", { class: rowClass, style: "display:flex;justify-content:space-between;align-items:center;margin-top:8px;width:100%;box-sizing:border-box;padding:8px 12px;border-radius:8px;border:1px dashed #9eb3d8;background:#eef5f7;font:13px system-ui,sans-serif;color:#152d34;gap:12px;" }, [
        ah.core.dom.el("strong", {}, "Per-unit cost"),
        ah.core.dom.el("span", { class: "ah-ae-per-unit-value" }),
        ah.core.dom.el("span", { class: "ah-ae-per-unit-message" })
      ]);
      estimatedRow.insertAdjacentElement("afterend", row);
    }
    ah.core.dom.qsa(`.${rowClass}`).forEach((other) => {
      if (other !== row) other.remove();
    });
    if (estimatedRow.nextElementSibling !== row) estimatedRow.insertAdjacentElement("afterend", row);
    return row;
  }

  function resolveSelectedProduct(selectedItem) {
    const targetImageUrl = backgroundImageUrl(selectedItem?.querySelector(".cart-summary-chosenCartLines-item-img"));
    if (!targetImageUrl) return null;
    return ah.core.dom.qsa(productSelector).find((product) =>
      backgroundImageUrl(product.querySelector(productImageSelector)) === targetImageUrl
    ) || null;
  }

  function updatePerUnitRow() {
    document.querySelectorAll(".ae-helper-cart-cad-total").forEach((node) => node.remove());
    const row = ensurePerUnitRow();
    if (!row) return;
    const valueNode = row.querySelector(".ah-ae-per-unit-value");
    const messageNode = row.querySelector(".ah-ae-per-unit-message");
    const estimatedContent = findEstimatedTotalRow()?.querySelector(summaryContentSelector);
    const parsed = parseCurrencyAmount(ah.core.dom.text(estimatedContent));
    if (!parsed) {
      row.hidden = true;
      return;
    }

    const selectedItems = ah.core.dom.qsa(chosenItemSelector);
    if (selectedItems.length !== 1) {
      valueNode.textContent = "";
      messageNode.textContent = "Select exactly one item to calculate.";
      row.hidden = false;
      return;
    }

    const product = resolveSelectedProduct(selectedItems[0]);
    const quantity = Number(product?.querySelector(quantityInputSelector)?.value?.replace(/,/g, ""));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      row.hidden = true;
      return;
    }

    valueNode.textContent = `${parsed.currency || ""}${(parsed.amount / quantity).toFixed(2)}`;
    messageNode.textContent = "";
    row.hidden = false;
  }

  function scheduleUpdate() {
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      updateTimer = null;
      updatePerUnitRow();
    }, 150);
  }

  function ensure() {
    if (!ah.sites.aliexpress.detect.isCartPage()) return;
    scheduleUpdate();
    if (installed) return;
    installed = true;
    document.addEventListener("input", (event) => {
      if (event.target?.matches?.(quantityInputSelector)) scheduleUpdate();
    }, true);
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.(productSelector)) scheduleUpdate();
    }, true);
  }

  ah.features.aliexpressCartPerUnit.ensure = ensure;
})();
