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
    const button = target?.closest?.("button");
    if (!button) return null;
    if (button.classList.contains("transactions-list-v2__details__mark-reviewed")) return button;
    return textIncludes(button, "Mark as reviewed") ? button : null;
  }

  function findSaveButtonNear(markButton) {
    const modal = markButton.closest(".wv-modal, [role='dialog']");
    const scope = modal || document;
    const footer = ah.core.dom.visible(ah.core.dom.qsa(".wv-modal__footer, footer, [data-testid*='footer']", scope))[0] || scope;
    return footer.querySelector('button[aria-label="Save transaction"]') ||
      ah.core.dom.findByText(footer, "button.wv-button--primary, button", "Save");
  }

  async function autoSave(markButton) {
    if (!ah.core.settings.get("wave.markReviewedAutoSave", false)) return;
    if (inFlight) return;
    inFlight = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 220));
      const saveButton = await ah.core.dom.waitFor(() => {
        const button = findSaveButtonNear(markButton);
        return button && !button.disabled && button.getAttribute("aria-disabled") !== "true" ? button : null;
      }, { timeout: 4000, interval: 80 });
      saveButton.click();
      ah.features.waveSavingsDashboard.addClicks(1, "MARK_REVIEWED");
      ah.ui.toast.show("Saved after mark reviewed.");
    } catch (_error) {
      ah.core.logger.warn("Save button did not become available after mark reviewed");
    } finally {
      setTimeout(() => { inFlight = false; }, 300);
    }
  }

  function ensurePanelToggle() {
    const panel = document.getElementById("ah-wave-panel");
    if (!panel || panel.querySelector("[data-ah-mark-reviewed-save]")) return;
    const checkbox = ah.core.dom.el("input", { type: "checkbox", "data-ah-mark-reviewed-save": "1" });
    checkbox.checked = ah.core.settings.get("wave.markReviewedAutoSave", false);
    checkbox.addEventListener("change", () => {
      ah.core.settings.set("wave.markReviewedAutoSave", checkbox.checked);
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
