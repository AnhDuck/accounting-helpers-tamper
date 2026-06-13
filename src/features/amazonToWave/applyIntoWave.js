(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.amazonToWave = ah.features.amazonToWave || {};

  const pendingKey = ah.core.constants.storageKeys.aliPendingPayload;
  const modalActionsClass = "ah-amazon-to-wave-modal-actions";
  const bannerId = "ah-amazon-to-wave-banner";

  function pendingPayload() {
    const payload = ah.core.storage.get(pendingKey, null);
    return ah.features.amazonToWave.payload.isValidPayload(payload) ? payload : null;
  }

  function clearPendingPayload() {
    ah.core.storage.remove(pendingKey);
    ah.ui.floatingPanel.remove(bannerId);
    window.dispatchEvent(new CustomEvent(ah.core.constants.events.pendingPayloadChanged));
  }

  function primaryTitle(payload) {
    return payload?.description?.productTitle || payload?.products?.[0]?.title || "";
  }

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function formatDescription(existing, payload) {
    const base = normalize(existing) || payload.description?.originalMerchant || "Amazon";
    const title = normalize(primaryTitle(payload));
    if (!title) return base;
    const lowerBase = base.toLowerCase();
    if (lowerBase.includes(title.toLowerCase()) || lowerBase.includes(String(payload.orderId || "").toLowerCase())) return base;
    const productPrefix = payload.products?.length > 1 ? `${payload.products.length} items | ${title}` : title;
    return `${base} | ${productPrefix}`;
  }

  function amountWarning(payload) {
    const raw = ah.sites.wave.transactionModal.readField(["amount", "total"]);
    const waveAmount = ah.core.money.parseMoney(raw);
    const amazonAmount = Number(payload?.amount?.value);
    if (!Number.isFinite(waveAmount) || !Number.isFinite(amazonAmount)) return "";
    const delta = Math.abs(ah.core.money.roundCents(waveAmount) - ah.core.money.roundCents(amazonAmount));
    if (delta < 0.01) return "";
    const amazonFormatted = ah.core.money.formatCurrency(amazonAmount, payload.amount.currency);
    const waveFormatted = ah.core.money.formatCurrency(waveAmount, payload.amount.currency);
    return `Amazon staged amount is ${amazonFormatted} but Wave modal shows ${waveFormatted}. Review before saving.`;
  }

  function recordLastApplyResult(result) {
    const next = Object.assign({ recordedAt: new Date().toISOString() }, result || {});
    ah.features.amazonToWave.lastApplyResult = next;
    return next;
  }

  async function applyIntoOpenTransaction(payload, options) {
    const modal = ah.sites.wave.transactionModal.findOpenModal();
    if (!modal) {
      const result = recordLastApplyResult({
        ok: false,
        complete: false,
        orderId: payload?.orderId || "",
        filled: [],
        warnings: [],
        modalStillOpen: false,
        saved: false,
        message: "Open the matching imported Amazon transaction in Wave, then click Apply Amazon details."
      });
      ah.ui.toast.show(result.message, { tone: "warn" });
      return result;
    }

    const descriptionField = ah.sites.wave.transactionModal.findField(["description", "notes"]);
    if (!descriptionField) {
      const result = recordLastApplyResult({
        ok: false,
        complete: false,
        orderId: payload.orderId,
        filled: [],
        warnings: [],
        modalStillOpen: !!ah.sites.wave.transactionModal.findOpenModal(),
        saved: false,
        message: "Could not find the Wave description field."
      });
      ah.ui.toast.show(result.message, { tone: "warn" });
      return result;
    }

    const existing = descriptionField.value || "";
    const nextDescription = formatDescription(existing, payload);
    const changed = nextDescription !== existing;
    const ok = changed ? ah.core.react.setFieldValue(descriptionField, nextDescription) : true;
    const accountResult = await ah.features.waveAccountSwitcher.switchToPreferred?.(modal);
    const taxResult = options?.applyTaxes ?
      await ah.features.waveTaxButtons.applyBothInOpenTransaction?.() :
      null;
    const warning = amountWarning(payload);
    const warnings = [];
    if (warning) warnings.push(warning);
    if (accountResult?.attempted && !accountResult.ok) warnings.push(`Preferred account was not selected: ${accountResult.reason}`);
    if (taxResult && !taxResult.ok) warnings.push(`GST + PST was not applied: ${taxResult.reason}`);
    const filled = [];
    if (changed) filled.push("description");
    if (accountResult?.attempted && accountResult.ok) filled.push("account");
    if (taxResult?.ok) filled.push("GST + PST");
    const result = recordLastApplyResult({
      ok,
      complete: ok,
      orderId: payload.orderId,
      filled,
      skipped: changed ? [] : ["description already contains Amazon details"],
      warnings,
      modalStillOpen: !!ah.sites.wave.transactionModal.findOpenModal(),
      saved: false,
      message: warnings[0] || (options?.applyTaxes ? "Applied Amazon details and GST + PST. Review and save manually." : `Applied Amazon details for ${payload.orderId}. Review and save manually.`)
    });
    ah.ui.toast.show(result.message, { tone: warnings.length ? "warn" : "success" });
    return result;
  }

  function removeModalActions() {
    document.querySelectorAll(`.${modalActionsClass}`).forEach((node) => node.remove());
  }

  function isSamePayload(container, payload) {
    return container?.dataset?.ahOrderId === String(payload.orderId) &&
      container?.dataset?.ahAmount === String(payload.amount.value) &&
      container?.dataset?.ahCurrency === String(payload.amount.currency);
  }

  function renderPayloadSummary(payload) {
    const amount = ah.core.money.formatCurrency(payload.amount.value, payload.amount.currency);
    const title = primaryTitle(payload);
    return ah.core.dom.el("div", { class: "ah-amz-pending-summary" }, [
      ah.core.dom.el("div", { class: "ah-amz-pending-kicker" }, "Pending Amazon order"),
      ah.core.dom.el("div", { class: "ah-amz-pending-main" }, [
        ah.core.dom.el("strong", {}, payload.orderId),
        ah.core.dom.el("span", { class: "ah-amz-pending-amount" }, amount)
      ]),
      ah.core.dom.el("div", { class: "ah-amz-pending-product" }, title || "Open the matching imported transaction.")
    ]);
  }

  function renderModalActions(payload) {
    return ah.core.dom.el("div", {
      class: modalActionsClass,
      "data-ah-order-id": payload.orderId,
      "data-ah-amount": payload.amount.value,
      "data-ah-currency": payload.amount.currency
    }, [
      renderPayloadSummary(payload),
      ah.core.dom.el("div", { class: "ah-amz-pending-actions" }, [
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button",
          title: "Append Amazon product details and select the preferred card account when the imported card account is visible.",
          onclick: () => applyIntoOpenTransaction(payload)
        }, "Apply Amazon details"),
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button",
          style: "background:#b43232;border-color:#922929;",
          title: "Apply Amazon details, select the preferred card account when needed, and apply GST + PST. Use after checking the invoice includes both taxes.",
          onclick: () => applyIntoOpenTransaction(payload, { applyTaxes: true })
        }, "Apply details + GST/PST"),
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button ah-button-secondary",
          title: "Remove this staged Amazon order.",
          onclick: clearPendingPayload
        }, "Clear")
      ])
    ]);
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
      modal.prepend(renderModalActions(payload));
      return;
    }
    if (!isSamePayload(actions, payload)) actions.replaceWith(renderModalActions(payload));
  }

  function renderBanner(payload) {
    return ah.core.dom.el("div", { class: "ah-amz-pending-card" }, [
      renderPayloadSummary(payload),
      ah.core.dom.el("div", { class: "ah-help", style: "margin-top:6px;" }, "Open the matching imported Amazon transaction in Wave, then click Apply Amazon details."),
      ah.core.dom.el("div", { class: "ah-amz-pending-actions" }, [
        ah.core.dom.el("button", {
          type: "button",
          class: "ah-button ah-button-secondary",
          title: "Remove this staged Amazon order.",
          onclick: clearPendingPayload
        }, "Clear")
      ])
    ]);
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

  function ensureWaveApplyUI() {
    if (!ah.sites.wave.detect.isWave()) return;
    const payload = pendingPayload();
    if (!payload || document.getElementById("ah-settings-modal")) {
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
  }

  ah.features.amazonToWave.applyIntoWave = {
    pendingPayload,
    clearPendingPayload,
    applyIntoOpenTransaction,
    ensureWaveApplyUI
  };
  ah.features.amazonToWave.ensureWaveApplyUI = ensureWaveApplyUI;
  ah.features.amazonToWave.getLastApplyResult = () => ah.features.amazonToWave.lastApplyResult || null;
})();
