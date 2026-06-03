(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.aliexpressCadCopy = ah.features.aliexpressCadCopy || {};

  const rateUrl = "https://open.er-api.com/v6/latest/USD";
  const rateRefreshMs = 10 * 60 * 1000;
  const containerSelector = ".order-item-content-opt-price";
  const totalSelector = '[data-pl="order_item_content_price_total"]';
  const rowClass = "ah-ae-cad-row";
  let cadRate = null;
  let lastRateFetch = 0;
  let scanScheduled = false;

  function copyText(text) {
    if (typeof GM_setClipboard === "function") {
      GM_setClipboard(text);
      return;
    }
    navigator.clipboard?.writeText?.(text).catch(() => {});
  }

  function fetchJson(url) {
    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          onload: (response) => {
            try {
              resolve(JSON.parse(response.responseText));
            } catch (error) {
              reject(error);
            }
          },
          onerror: reject
        });
      });
    }
    return fetch(url, { credentials: "omit" }).then((response) => response.json());
  }

  async function ensureRate() {
    const now = Date.now();
    if (cadRate && now - lastRateFetch < rateRefreshMs) return cadRate;
    const data = await fetchJson(rateUrl);
    if (!data?.rates?.CAD) throw new Error("CAD rate missing");
    cadRate = data.rates.CAD;
    lastRateFetch = now;
    return cadRate;
  }

  function usdText(totalNode) {
    const priceNode = totalNode.querySelector("div");
    return ah.core.dom.text(priceNode || totalNode);
  }

  function handleCopy(button, text) {
    copyText(text);
    const original = button.textContent;
    button.textContent = "Copied";
    button.disabled = true;
    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 1200);
  }

  async function updateCadRow(container, totalNode) {
    let rate;
    try {
      rate = await ensureRate();
    } catch (error) {
      ah.core.logger.warn("FX rate unavailable", String(error));
      return;
    }
    const usdValue = ah.core.money.parseMoney(usdText(totalNode));
    if (usdValue === null) return;
    const cadAmount = ah.core.money.roundCents(usdValue * rate);
    const cadDisplay = ah.core.money.formatCurrency(cadAmount, "CAD").replace("$", "CA $");
    const host = container.closest(".order-item-content-opt") || container.parentElement;
    if (!host) return;

    let row = host.querySelector(`:scope > .${rowClass}`);
    if (!row) {
      row = ah.core.dom.el("div", { class: `${rowClass} ah-ae-row` });
      const badge = ah.core.dom.el("span", { class: "ah-ae-total" }, "CAD Total");
      const value = ah.core.dom.el("span", { "data-ah-cad-total": "" });
      const copy = ah.core.dom.el("button", { type: "button", class: "ah-button ah-button-secondary" }, "Copy");
      copy.addEventListener("click", () => handleCopy(copy, value.dataset.value || ""));
      row.append(badge, value, copy);
      host.insertBefore(row, host.querySelector(".order-item-btns-wrap") || null);
    }

    const value = row.querySelector("[data-ah-cad-total]");
    value.textContent = cadDisplay;
    value.dataset.value = cadAmount.toFixed(2);
    row.setAttribute("data-ah-cad-total", cadAmount.toFixed(2));
  }

  function enhanceTotal(container) {
    const totalNode = container.querySelector(totalSelector);
    if (totalNode) updateCadRow(container, totalNode);
  }

  function scan() {
    ah.core.dom.qsa(containerSelector).forEach(enhanceTotal);
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      scan();
    });
  }

  function ensure() {
    if (!ah.sites.aliexpress.detect.isOrderPage()) return;
    scheduleScan();
  }

  ah.features.aliexpressCadCopy.ensure = ensure;
  ah.features.aliexpressCadCopy.scheduleScan = scheduleScan;
  ah.features.aliexpressCadCopy.ensureRate = ensureRate;
})();
