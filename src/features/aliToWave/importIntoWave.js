(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.aliToWave = ah.features.aliToWave || {};

  const pendingKey = ah.core.constants.storageKeys.aliPendingPayload;
  const modalActionsClass = "ah-ali-to-wave-modal-actions";
  const bannerId = "ah-ali-to-wave-banner";
  let autoFillInFlight = false;
  let autoFillAttemptKey = "";
  let createFillInFlight = false;
  let autoCreateAttemptKey = "";

  function pendingPayload() {
    const payload = ah.core.storage.get(pendingKey, null);
    return ah.features.aliToWave.payload.isValidPayload(payload) ? payload : null;
  }

  function clearPendingPayload() {
    ah.core.storage.remove(pendingKey);
    ah.ui.floatingPanel.remove(bannerId);
    window.dispatchEvent(new CustomEvent(ah.core.constants.events.pendingPayloadChanged));
  }

  function recordLastFillResult(result) {
    const next = Object.assign({ recordedAt: new Date().toISOString() }, result || {});
    ah.features.aliToWave.lastFillResult = next;
    return next;
  }

  async function fillOpenTransaction(payload) {
    const result = await ah.sites.wave.fillTransaction.fillFromAliPayload(payload);
    let duplicateGuardMarkedImported = false;
    let pendingPayloadCleared = false;
    if (result.complete) {
      duplicateGuardMarkedImported = ah.features.aliToWave.duplicateGuard.markImported(payload);
      clearPendingPayload();
      pendingPayloadCleared = true;
    }
    const detailedResult = recordLastFillResult(Object.assign({}, result, {
      duplicateGuardMarkedImported,
      pendingPayloadCleared
    }));
    ah.ui.toast.show(detailedResult.message, { tone: detailedResult.complete ? "success" : "warn" });
    return detailedResult;
  }

  function payloadKey(payload) {
    return [
      payload?.orderId || "",
      payload?.amount?.value || "",
      payload?.amount?.currency || ""
    ].join("|");
  }

  async function createWithdrawalAndFill(payload, options) {
    if (createFillInFlight) {
      return recordLastFillResult({ ok: false, complete: false, message: "Wave helper is already creating a withdrawal." });
    }
    if (ah.sites.wave.transactionModal.findOpenModal()) {
      const result = recordLastFillResult({ ok: false, complete: false, message: "A Wave transaction modal is already open. Review it or close it before creating a new withdrawal." });
      if (options?.toast !== false) ah.ui.toast.show(result.message, { tone: "warn" });
      return result;
    }

    createFillInFlight = true;
    try {
      const opened = await ah.sites.wave.transactionList.openAddWithdrawalModal();
      if (!opened.ok) {
        if (options?.toast !== false) ah.ui.toast.show(opened.message, { tone: "warn" });
        return recordLastFillResult(Object.assign({ complete: false }, opened));
      }
      autoFillAttemptKey = payloadKey(payload);
      const result = await fillOpenTransaction(payload);
      recordCreateFillSavings(opened, result);
      return result;
    } finally {
      createFillInFlight = false;
    }
  }

  function recordCreateFillSavings(opened, result) {
    if (!result?.complete) return;
    const steps = [...(opened.clicksSavedSteps || []), "Fill staged AliExpress order"];
    if (!steps.length) return;
    ah.features.waveSavingsDashboard?.addClicks?.(
      steps.length,
      `AliExpress to Wave: ${steps.join(", ")}`
    );
    ah.ui.toast.show(`Saved ${steps.length} clicks: ${steps.join(", ")}.`, { title: "Clicks saved" });
  }

  function renderBanner(payload) {
    const amount = ah.core.money.formatCurrency(payload.amount.value, payload.amount.currency);
    const content = ah.core.dom.el("div", {}, [
      ah.core.dom.el("strong", {}, `Pending AliExpress order: ${payload.orderId}`),
      ah.core.dom.el("div", { style: "margin-bottom:8px;" }, `CAD amount: ${amount}`),
      ah.core.dom.el("div", { class: "ah-help" }, "One order is staged at a time. Staging another AliExpress order replaces this one."),
      ah.core.dom.el("div", { class: "ah-pill-row" }, [
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button",
          title: "Open Wave's Add withdrawal modal, then fill it with this staged AliExpress order.",
          onclick: () => createWithdrawalAndFill(payload)
        }, "Create withdrawal + fill"),
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button ah-button-secondary",
          title: "Fill the currently open Wave edit transaction modal with this staged AliExpress order.",
          onclick: () => fillOpenTransaction(payload)
        }, "Fill this transaction"),
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button ah-button-secondary",
          title: "Remove this staged AliExpress order without marking it imported.",
          onclick: clearPendingPayload
        }, "Clear")
      ])
    ]);
    return content;
  }

  function removeModalActions() {
    document.querySelectorAll(`.${modalActionsClass}`).forEach((node) => node.remove());
  }

  function renderModalActions(payload) {
    const amount = ah.core.money.formatCurrency(payload.amount.value, payload.amount.currency);
    return ah.core.dom.el("div", {
      class: modalActionsClass,
      "data-ah-order-id": payload.orderId,
      "data-ah-amount": payload.amount.value,
      "data-ah-currency": payload.amount.currency
    }, [
      ah.core.dom.el("strong", {}, `AliExpress order ${payload.orderId}`),
      ah.core.dom.el("span", {}, amount),
      ah.core.dom.el("span", { class: "ah-help" }, "Latest staged order"),
      ah.core.dom.el("button", {
        type: "button",
        class: "ah-button",
        title: "Fill this Wave transaction with the staged AliExpress order.",
        onclick: () => fillOpenTransaction(payload)
      }, "Fill AliExpress order"),
      ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        title: "Remove this staged AliExpress order without marking it imported.",
        onclick: clearPendingPayload
      }, "Clear")
    ]);
  }

  function isSamePayload(container, payload) {
    return container?.dataset?.ahOrderId === String(payload.orderId) &&
      container?.dataset?.ahAmount === String(payload.amount.value) &&
      container?.dataset?.ahCurrency === String(payload.amount.currency);
  }

  function ensureModalActions(payload) {
    const modal = ah.sites.wave.transactionModal.findOpenModal();
    if (!modal) {
      removeModalActions();
      return;
    }
    document.querySelectorAll(`.${modalActionsClass}`).forEach((node) => {
      if (!modal.contains(node)) node.remove();
    });
    let actions = modal.querySelector(`.${modalActionsClass}`);
    if (!actions) {
      actions = renderModalActions(payload);
      modal.prepend(actions);
      return;
    }
    if (isSamePayload(actions, payload)) return;
    actions.replaceWith(renderModalActions(payload));
  }

  function ensureBanner(payload) {
    const panel = document.getElementById(bannerId);
    if (isSamePayload(panel, payload)) return;
    ah.ui.floatingPanel.ensure(bannerId, (node) => {
      node.dataset.ahOrderId = String(payload.orderId);
      node.dataset.ahAmount = String(payload.amount.value);
      node.dataset.ahCurrency = String(payload.amount.currency);
      return renderBanner(payload);
    });
  }

  async function maybeAutoFill(payload) {
    if (payload?.debug?.autoFillSuppressed) return;
    const key = payloadKey(payload);
    if (autoFillInFlight || createFillInFlight || autoFillAttemptKey === key) return;
    if (!ah.core.settings.get("aliToWave.autoFillPending", false)) return;
    if (!ah.sites.wave.transactionModal.findOpenModal()) return;
    autoFillAttemptKey = key;
    autoFillInFlight = true;
    try {
      await fillOpenTransaction(payload);
    } finally {
      autoFillInFlight = false;
    }
  }

  async function maybeAutoCreateWithdrawal(payload) {
    if (payload?.debug?.autoFillSuppressed) return;
    const key = payloadKey(payload);
    if (createFillInFlight || autoCreateAttemptKey === key) return;
    if (!ah.core.settings.get("aliToWave.autoCreateWithdrawal", false)) return;
    if (ah.sites.wave.transactionModal.findOpenModal()) return;
    autoCreateAttemptKey = key;
    const result = await createWithdrawalAndFill(payload, { toast: false });
    if (!result.ok) {
      ah.ui.toast.show(result.message, { tone: "warn" });
    }
  }

  function ensureWaveImportUI() {
    if (!ah.sites.wave.detect.isWave()) return;
    const payload = pendingPayload();
    if (!payload) {
      ah.ui.floatingPanel.remove(bannerId);
      removeModalActions();
      autoFillAttemptKey = "";
      autoCreateAttemptKey = "";
      return;
    }
    if (document.getElementById("ah-settings-modal")) {
      ah.ui.floatingPanel.remove(bannerId);
      removeModalActions();
      return;
    }
    if (ah.sites.wave.transactionModal.findOpenModal()) {
      ah.ui.floatingPanel.remove(bannerId);
      ensureModalActions(payload);
    } else {
      removeModalActions();
      ensureBanner(payload);
    }
    maybeAutoCreateWithdrawal(payload);
    maybeAutoFill(payload);
  }

  ah.features.aliToWave.importIntoWave = { pendingPayload, clearPendingPayload, fillOpenTransaction, createWithdrawalAndFill };
  ah.features.aliToWave.ensureWaveImportUI = ensureWaveImportUI;
  ah.features.aliToWave.getLastFillResult = () => ah.features.aliToWave.lastFillResult || null;
})();
