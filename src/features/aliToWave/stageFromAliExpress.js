(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.aliToWave = ah.features.aliToWave || {};

  const pendingKey = ah.core.constants.storageKeys.aliPendingPayload;

  function setButtonState(button, text, tone) {
    button.textContent = text;
    button.disabled = tone === "disabled";
    button.dataset.state = tone || "";
  }

  function pendingPayload() {
    return ah.core.storage.get(pendingKey, null);
  }

  function clearPendingPayload() {
    ah.core.storage.remove(pendingKey);
    window.dispatchEvent(new CustomEvent(ah.core.constants.events.pendingPayloadChanged));
  }

  function savePendingPayload(payload) {
    const ok = ah.core.storage.set(pendingKey, payload);
    window.dispatchEvent(new CustomEvent(ah.core.constants.events.pendingPayloadChanged, { detail: payload }));
    return ok;
  }

  function orderFromButton(button) {
    const row = button.closest(".ah-ae-cad-row, .ae-helper-cad-row, [data-ah-cad-total]") || button;
    const root = ah.sites.aliexpress.extractOrder.findOrderRoot(row);
    return {
      orderId: ah.sites.aliexpress.extractOrder.extractOrderId(root),
      orderDate: ah.sites.aliexpress.extractOrder.extractOrderDate(root),
      cadTotal: ah.sites.aliexpress.extractOrder.extractCadTotal(root),
      sourceUrl: location.href,
      root
    };
  }

  async function sendToWave(button) {
    const order = orderFromButton(button);
    if (!order.orderId) {
      setButtonState(button, "Could not find order ID on this order card", "warn");
      return;
    }
    if (ah.features.aliToWave.duplicateGuard.isImported(order.orderId) && !ah.core.settings.get("aliToWave.allowReimport", false)) {
      setButtonState(button, "Already imported", "disabled");
      return;
    }
    if (order.cadTotal === null || order.cadTotal === undefined) {
      setButtonState(button, "Failed: missing CAD total", "warn");
      return;
    }

    const payload = ah.features.aliToWave.payload.createAliToWavePayload({
      orderId: order.orderId,
      orderDate: order.orderDate,
      cadAmount: order.cadTotal,
      sourceUrl: order.sourceUrl
    });

    savePendingPayload(payload);
    setButtonState(button, "Sent to Wave", "disabled");
    ah.ui.toast.show("AliExpress order staged for Wave.");

    if (ah.core.settings.get("aliToWave.autoOpenWave", false) && typeof GM_openInTab === "function") {
      GM_openInTab(ah.core.constants.waveTransactionsUrl, { active: true, insert: true });
    }
  }

  function injectButton(row) {
    if (!row || row.querySelector(".ah-send-to-wave")) return;
    const value = ah.core.money.parseMoney(row.getAttribute("data-ah-cad-total") || row.querySelector("[data-ah-cad-total]")?.dataset.value);
    if (value === null) return;
    const button = ah.core.dom.el("button", {
      type: "button",
      class: "ah-button ah-send-to-wave",
      onclick: () => sendToWave(button)
    }, "Send to Wave");
    row.append(button);

    const order = orderFromButton(button);
    if (order.orderId && ah.features.aliToWave.duplicateGuard.isImported(order.orderId) && !ah.core.settings.get("aliToWave.allowReimport", false)) {
      setButtonState(button, "Already imported", "disabled");
    }
  }

  function ensureAliExpressSendButton() {
    if (!ah.sites.aliexpress.detect.isOrderPage()) return;
    document.querySelectorAll(".ah-ae-cad-row, .ae-helper-cad-row").forEach(injectButton);
  }

  ah.features.aliToWave.stageFromAliExpress = { pendingPayload, clearPendingPayload, savePendingPayload };
  ah.features.aliToWave.ensureAliExpressSendButton = ensureAliExpressSendButton;
})();
