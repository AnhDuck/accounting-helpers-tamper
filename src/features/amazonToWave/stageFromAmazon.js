(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.amazonToWave = ah.features.amazonToWave || {};

  const pendingKey = ah.core.constants.storageKeys.aliPendingPayload;

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

  async function stageOrder(orderCardEl) {
    const order = await ah.sites.amazon.extractOrder.extractOrder(orderCardEl);
    if (!order.orderId) {
      ah.ui.toast.show("Could not find the Amazon order ID on this order card.", { tone: "warn" });
      return null;
    }
    if (!order.amount?.value) {
      ah.ui.toast.show("Could not find the Amazon order total on this order card.", { tone: "warn" });
      return null;
    }
    const payload = ah.features.amazonToWave.payload.createAmazonToWavePayload(order);
    if (!savePendingPayload(payload)) {
      ah.ui.toast.show("Could not stage this Amazon order for Wave.", { tone: "error" });
      return null;
    }
    if (await isWaveOpen()) {
      ah.ui.toast.show(`Amazon order ${payload.orderId} staged. Open the matching imported Wave transaction, then apply details.`);
    } else {
      ah.ui.toast.show("Amazon order staged. Opening Wave transactions...");
      openWaveTransactions();
    }
    return payload;
  }

  function stageFakeAmazonOrder() {
    const payload = ah.features.amazonToWave.payload.fakePayload();
    const ok = savePendingPayload(payload);
    ah.ui.toast.show(ok ? "Staged fake Amazon order for Wave testing." : "Could not stage fake Amazon order.", { tone: ok ? "success" : "error" });
    return ok ? payload : null;
  }

  ah.features.amazonToWave.stageFromAmazon = {
    pendingPayload,
    clearPendingPayload,
    savePendingPayload,
    stageOrder,
    stageFakeAmazonOrder
  };
})();
