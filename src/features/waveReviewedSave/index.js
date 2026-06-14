(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.waveReviewedSave = ah.features.waveReviewedSave || {};

  let installed = false;
  let inFlight = false;

  function textIncludes(node, needle) {
    return ah.core.dom.text(node).toLowerCase().includes(String(needle).toLowerCase());
  }

  function findMarkReviewedButton(target) {
    const button = target?.closest?.("button, [role='button'], [role='menuitem']");
    if (!button) return null;
    if (button.classList.contains("transactions-list-v2__details__mark-reviewed")) return button;
    return textIncludes(button, "Mark as reviewed") ? button : null;
  }

  function isUnavailable(button) {
    return button.disabled ||
      button.getAttribute("aria-disabled") === "true" ||
      button.getAttribute("disabled") !== null ||
      button.classList.contains("disabled") ||
      button.classList.contains("wv-button--disabled");
  }

  function isHelperUi(button) {
    return !!button.closest("#ah-wave-panel, #ah-dev-status, #ah-diagnostics-panel, #ah-settings-modal, .ah-modal");
  }

  function isSaveButton(button) {
    const ariaLabel = button.getAttribute("aria-label") || "";
    if (/^save transaction$/i.test(ariaLabel.trim())) return true;
    return ah.core.dom.text(button).trim().toLowerCase() === "save";
  }

  function modalNear(button) {
    return ah.sites.wave.transactionModal.findOpenModal() ||
      button?.closest?.(".wv-modal, [role='dialog']");
  }

  function buttonScopesNear(button) {
    const root = modalNear(button) || document;
    return [
      ...ah.core.dom.visible(ah.core.dom.qsa(".wv-modal__footer, footer, [data-testid*='footer']", root)),
      root
    ];
  }

  function findSaveButtonNear(button) {
    for (const scope of buttonScopesNear(button)) {
      const button = ah.core.dom.visible(ah.core.dom.qsa("button, [role='button']", scope))
        .find((candidate) => !isHelperUi(candidate) && isSaveButton(candidate) && !isUnavailable(candidate));
      if (button) return button;
    }
    return null;
  }

  async function waitForModalClosed() {
    try {
      await ah.core.dom.waitFor(() => ah.sites.wave.transactionModal.findOpenModal() ? null : true, {
        timeout: 3000,
        interval: 100
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  async function clickSaveAfterReview(anchorButton, options) {
    await new Promise((resolve) => setTimeout(resolve, options?.delayMs || 220));
    const saveButton = await ah.core.dom.waitFor(() => {
      return findSaveButtonNear(anchorButton);
    }, { timeout: 4000, interval: 80 });
    saveButton.click();
    ah.features.waveSavingsDashboard.addClicks(options?.clicksSaved || 1, options?.action || "MARK_REVIEWED");
    if (await waitForModalClosed()) {
      ah.ui.toast.show("Saved after Mark as reviewed.");
    } else {
      ah.core.logger.warn("Save was clicked after mark reviewed, but the transaction modal stayed open");
      ah.ui.toast.show("Clicked Save, but Wave left the modal open.", { tone: "warn" });
    }
  }

  async function withReviewSaveLock(task, warningMessage) {
    if (!ah.core.settings.get("wave.markReviewedAutoSave", false)) return;
    if (inFlight) return;
    inFlight = true;
    try {
      await task();
    } catch (_error) {
      ah.core.logger.warn(warningMessage);
    } finally {
      setTimeout(() => { inFlight = false; }, 300);
    }
  }

  function autoSave(markButton) {
    withReviewSaveLock(
      () => clickSaveAfterReview(markButton),
      "Save button did not become available after mark reviewed"
    );
  }

  function ensurePanelToggle() {
    const panel = document.getElementById("ah-wave-panel");
    if (!panel || panel.querySelector("[data-ah-mark-reviewed-save]")) return;
    const checkbox = ah.core.dom.el("input", { type: "checkbox", "data-ah-mark-reviewed-save": "1" });
    checkbox.checked = ah.core.settings.get("wave.markReviewedAutoSave", false);
    checkbox.addEventListener("change", () => {
      ah.core.settings.set("wave.markReviewedAutoSave", checkbox.checked, { source: "settings-modal" });
      ah.ui.toast.show(`Save after Mark as reviewed ${checkbox.checked ? "ON" : "OFF"}.`);
    });
    panel.append(ah.core.dom.el("label", {
      class: "ah-check",
      style: "white-space:nowrap;",
      title: "After you click Mark as reviewed, automatically click Save when enabled."
    }, [checkbox, "Save after reviewed"]));
  }

  function ensure() {
    if (!ah.sites.wave.detect.isWave()) return;
    ah.features.waveSavingsDashboard.ensure();
    ensurePanelToggle();
    if (installed) return;
    installed = true;
    document.addEventListener("click", (event) => {
      const markButton = findMarkReviewedButton(event.target);
      if (markButton) autoSave(markButton);
    }, true);
  }

  ah.features.waveReviewedSave.ensure = ensure;
})();
