(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.aliToWave = ah.features.aliToWave || {};

  const pendingKey = ah.core.constants.storageKeys.aliPendingPayload;
  const modalActionsClass = "ah-ali-to-wave-modal-actions";
  let autoFillInFlight = false;

  function pendingPayload() {
    const payload = ah.core.storage.get(pendingKey, null);
    return ah.features.aliToWave.payload.isValidPayload(payload) ? payload : null;
  }

  function clearPendingPayload() {
    ah.core.storage.remove(pendingKey);
    ah.ui.floatingPanel.remove("ah-ali-to-wave-banner");
    window.dispatchEvent(new CustomEvent(ah.core.constants.events.pendingPayloadChanged));
  }

  async function fillOpenTransaction(payload) {
    const result = await ah.sites.wave.fillTransaction.fillFromAliPayload(payload);
    ah.ui.toast.show(result.message, { tone: result.ok ? "success" : "warn" });
    if (result.ok) {
      ah.features.aliToWave.duplicateGuard.markImported(payload);
      clearPendingPayload();
    }
    return result;
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
    return ah.core.dom.el("div", { class: modalActionsClass }, [
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

  function ensureModalActions(payload) {
    const modal = ah.sites.wave.transactionModal.findOpenModal();
    if (!modal) {
      removeModalActions();
      return;
    }
    let actions = modal.querySelector(`.${modalActionsClass}`);
    if (!actions) {
      actions = renderModalActions(payload);
      modal.prepend(actions);
      return;
    }
    actions.replaceWith(renderModalActions(payload));
  }

  async function maybeAutoFill(payload) {
    if (autoFillInFlight || !ah.core.settings.get("aliToWave.autoFillPending", false)) return;
    if (!ah.sites.wave.transactionModal.findOpenModal()) return;
    autoFillInFlight = true;
    try {
      await fillOpenTransaction(payload);
    } finally {
      autoFillInFlight = false;
    }
  }

  function ensureWaveImportUI() {
    if (!ah.sites.wave.detect.isWave()) return;
    const payload = pendingPayload();
    if (!payload) {
      ah.ui.floatingPanel.remove("ah-ali-to-wave-banner");
      removeModalActions();
      return;
    }
    ah.ui.floatingPanel.ensure("ah-ali-to-wave-banner", () => renderBanner(payload));
    ensureModalActions(payload);
    maybeAutoFill(payload);
  }

  ah.features.aliToWave.importIntoWave = { pendingPayload, clearPendingPayload, fillOpenTransaction };
  ah.features.aliToWave.ensureWaveImportUI = ensureWaveImportUI;
})();
