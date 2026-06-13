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

  function findStageButtons() {
    return ah.core.dom.qsa(".ah-send-to-wave");
  }

  function orderFromButton(button) {
    const row = button.closest(".ah-ae-cad-row, .ae-helper-cad-row, [data-ah-cad-total]") || button;
    const root = ah.sites.aliexpress.extractOrder.findOrderRoot(row);
    return {
      orderId: ah.sites.aliexpress.extractOrder.extractOrderId(root),
      orderDate: ah.sites.aliexpress.extractOrder.extractOrderDate(root),
      cadTotal: ah.sites.aliexpress.extractOrder.extractCadTotal(row) ?? ah.sites.aliexpress.extractOrder.extractCadTotal(root),
      sourceUrl: location.href,
      root
    };
  }

  function refreshStageButtons() {
    const pending = pendingPayload();
    findStageButtons().forEach((button) => {
      const order = orderFromButton(button);
      if (order.orderId && ah.features.aliToWave.duplicateGuard.isImported(order.orderId) && !ah.core.settings.get("aliToWave.allowReimport", false)) {
        setButtonState(button, "Already imported", "disabled");
        return;
      }
      if (pending?.orderId && order.orderId === pending.orderId) {
        setButtonState(button, "Staged for Wave", "disabled");
        return;
      }
      setButtonState(button, "Stage for Wave", "");
    });
  }

  async function isWaveOpen() {
    if (typeof ah.sites.wave?.heartbeat?.requestRecent === "function") {
      return ah.sites.wave.heartbeat.requestRecent();
    }
    return !!ah.sites.wave?.heartbeat?.isRecent?.();
  }

  function openWaveTransactions() {
    if (typeof GM_openInTab !== "function") return false;
    GM_openInTab(ah.core.constants.waveTransactionsUrl, { active: true, insert: true });
    return true;
  }

  async function stageForWave(button) {
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

    const previous = pendingPayload();
    if (!savePendingPayload(payload)) {
      setButtonState(button, "Stage failed", "warn");
      ah.ui.toast.show("Could not stage this order for Wave.", { tone: "error" });
      return;
    }
    refreshStageButtons();

    if (await isWaveOpen()) {
      const autoCreate = ah.core.settings.get("aliToWave.autoCreateWithdrawal", false);
      const action = autoCreate ?
        "Wave will create and fill a withdrawal unless a transaction modal is already open." :
        "Switch to Wave to create or fill a transaction.";
      const message = previous?.orderId && previous.orderId !== payload.orderId ?
        `Replaced the previously staged AliExpress order. ${action}` :
        `Order staged for Wave. ${action}`;
      ah.ui.toast.show(message);
      return;
    }

    ah.ui.toast.show("Order staged for Wave. Opening Wave transactions...");
    openWaveTransactions();
  }

  function injectButton(row) {
    if (!row || row.querySelector(".ah-send-to-wave")) return;
    const value = ah.core.money.parseMoney(row.getAttribute("data-ah-cad-total") || row.querySelector("[data-ah-cad-total]")?.dataset.value);
    if (value === null) return;
    const button = ah.core.dom.el("button", {
      type: "button",
      class: "ah-button ah-send-to-wave",
      title: "Stage this AliExpress order in Tampermonkey storage so it can fill an open Wave transaction modal.",
      onclick: () => stageForWave(button)
    }, "Stage for Wave");
    row.append(button);

    refreshStageButtons();
  }

  function ensureAliExpressSendButton() {
    if (!ah.sites.aliexpress.detect.isOrderPage()) return;
    document.querySelectorAll(".ah-ae-cad-row, .ae-helper-cad-row").forEach(injectButton);
    refreshStageButtons();
  }

  ah.features.aliToWave.stageFromAliExpress = { pendingPayload, clearPendingPayload, savePendingPayload };
  ah.features.aliToWave.ensureAliExpressSendButton = ensureAliExpressSendButton;
})();
