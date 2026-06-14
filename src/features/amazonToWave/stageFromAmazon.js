(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.amazonToWave = ah.features.amazonToWave || {};

  const pendingKey = ah.core.constants.storageKeys.aliPendingPayload;
  const applyRequestKey = ah.core.constants.storageKeys.amazonApplyRequest;

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

  function requestApplyInWave(payload, options) {
    const request = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      orderId: payload.orderId,
      createdAt: Date.now(),
      applyTaxes: !!options?.applyTaxes
    };
    return ah.core.storage.set(applyRequestKey, request);
  }

  async function stageOrder(orderCardEl, options) {
    const order = await ah.sites.amazon.extractOrder.extractOrder(orderCardEl);
    if (!order.orderId) {
      ah.ui.toast.show("Could not find the Amazon order ID on this order card.", { tone: "warn" });
      return null;
    }
    if (!order.amount?.value) {
      ah.ui.toast.show("Could not find the Amazon order total on this order card.", { tone: "warn" });
      return null;
    }
    if (options?.requireSingleInvoice !== false && Number(order.invoice?.count || 0) !== 1) {
      ah.ui.toast.show("Multiple or missing Amazon invoices detected. Open invoices and enter each one separately.", { tone: "warn" });
      return null;
    }
    const payload = ah.features.amazonToWave.payload.createAmazonToWavePayload(order);
    if (!savePendingPayload(payload)) {
      ah.ui.toast.show("Could not stage this Amazon order for Wave.", { tone: "error" });
      return null;
    }
    const waveOpen = await isWaveOpen();
    if (options?.applyInWave) {
      if (waveOpen && requestApplyInWave(payload, options)) {
        ah.ui.toast.show(`Amazon order ${payload.orderId} staged. Applying in the open Wave transaction...`);
      } else if (waveOpen) {
        ah.ui.toast.show("Amazon order staged, but could not request Wave auto-apply.", { tone: "warn" });
      } else {
        ah.ui.toast.show("Amazon order staged. Open the matching Wave transaction to apply details + tax.");
        openWaveTransactions();
      }
    } else if (waveOpen) {
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

  async function stageFakeAmazonOrderAndApply(options) {
    const payload = ah.features.amazonToWave.payload.fakePayload();
    const ok = savePendingPayload(payload);
    if (!ok) {
      ah.ui.toast.show("Could not stage fake Amazon order for Wave testing.", { tone: "error" });
      return null;
    }
    const waveOpen = await isWaveOpen();
    if (!waveOpen) {
      ah.ui.toast.show("Staged fake Amazon order. Open Wave to test auto-apply.", { tone: "warn" });
      return payload;
    }
    if (!requestApplyInWave(payload, { applyTaxes: options?.applyTaxes !== false })) {
      ah.ui.toast.show("Staged fake Amazon order, but could not request Wave auto-apply.", { tone: "warn" });
      return payload;
    }
    ah.ui.toast.show("Staged fake Amazon order and requested Wave auto-apply.");
    return payload;
  }

  ah.features.amazonToWave.stageFromAmazon = {
    pendingPayload,
    clearPendingPayload,
    savePendingPayload,
    stageOrder,
    requestApplyInWave,
    stageFakeAmazonOrder,
    stageFakeAmazonOrderAndApply
  };
})();
