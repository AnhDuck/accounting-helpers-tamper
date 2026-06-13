(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.waveSavingsDashboard = ah.features.waveSavingsDashboard || {};

  const KEY = ah.core.constants.storageKeys.savings;
  const legacyClicksKey = "tm_wave_clicks_saved";
  const legacyHistoryKey = "tm_wave_clicks_history";
  const secondsPerClick = 0.5;
  let panelClicksEl = null;

  function defaultState() {
    return { clicks: 0, history: [], startedAt: "2026-01-01" };
  }

  function state() {
    const stored = ah.core.storage.get(KEY, null);
    if (stored) return Object.assign(defaultState(), stored);

    const legacyClicks = Number(localStorage.getItem(legacyClicksKey));
    let legacyHistory = [];
    try {
      legacyHistory = JSON.parse(localStorage.getItem(legacyHistoryKey) || "[]");
    } catch (_error) {
      legacyHistory = [];
    }
    if (Number.isFinite(legacyClicks) || legacyHistory.length) {
      const migrated = {
        clicks: Number.isFinite(legacyClicks) ? legacyClicks : legacyHistory.reduce((sum, event) => sum + (Number(event.clicks) || 0), 0),
        history: legacyHistory,
        startedAt: "2026-01-01"
      };
      ah.core.storage.set(KEY, migrated);
      return migrated;
    }
    return defaultState();
  }

  function save(next) {
    ah.core.storage.set(KEY, next);
    updateSavingsUI();
  }

  function addClicks(delta, action) {
    const next = state();
    next.clicks += delta;
    next.history.push({
      timestamp: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      hour: new Date().getHours(),
      clicks: delta,
      action
    });
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    next.history = next.history.filter((event) => !event.timestamp || event.timestamp >= cutoff);
    save(next);
  }

  function formatTime(seconds) {
    if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.round(seconds % 60);
    if (minutes < 60) return `${minutes}m ${remaining}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  function updateSavingsUI() {
    if (!panelClicksEl) return;
    const data = state();
    panelClicksEl.textContent = `Saved: ${data.clicks} clicks (${formatTime(data.clicks * secondsPerClick)})`;
  }

  function getTodayClicks(history) {
    const today = new Date().toISOString().slice(0, 10);
    return history.filter((event) => event.date === today).reduce((sum, event) => sum + event.clicks, 0);
  }

  function aggregateByDay(history) {
    const byDay = {};
    history.forEach((event) => {
      byDay[event.date] = (byDay[event.date] || 0) + event.clicks;
    });
    return Object.entries(byDay).sort().slice(-14);
  }

  function openDashboard() {
    document.getElementById("ah-savings-dashboard")?.remove();
    const data = state();
    const byDay = aggregateByDay(data.history);
    const max = Math.max(1, ...byDay.map(([, clicks]) => clicks));
    const backdrop = ah.core.dom.el("div", { id: "ah-savings-dashboard", class: "ah-modal-backdrop" });
    const modal = ah.core.dom.el("div", { class: "ah-modal" });
    const stats = ah.core.dom.el("div", { class: "ah-form-grid" }, [
      ah.core.dom.el("div", {}, [`Today: ${getTodayClicks(data.history)} clicks`]),
      ah.core.dom.el("div", {}, [`Total: ${data.clicks} clicks`]),
      ah.core.dom.el("div", {}, [`Time saved: ${formatTime(data.clicks * secondsPerClick)}`])
    ]);
    const chart = ah.core.dom.el("div", { style: { display: "grid", gap: "6px", marginTop: "12px" } });
    byDay.forEach(([date, clicks]) => {
      chart.append(ah.core.dom.el("div", { style: { display: "grid", gridTemplateColumns: "92px 1fr 40px", gap: "8px", alignItems: "center" } }, [
        ah.core.dom.el("span", {}, date),
        ah.core.dom.el("span", { style: { background: "#39a16f", borderRadius: "4px", display: "block", height: "18px", width: `${Math.max(4, (clicks / max) * 100)}%` } }),
        ah.core.dom.el("strong", {}, clicks)
      ]));
    });
    modal.append(
      ah.core.dom.el("h2", {}, "Clicks Saved Dashboard"),
      stats,
      ah.core.dom.el("h3", {}, "Recent chart"),
      chart,
      ah.core.dom.el("div", { class: "ah-modal-actions" }, [
        ah.core.dom.el("button", { type: "button", class: "ah-button ah-button-secondary", onclick: () => backdrop.remove() }, "Close")
      ])
    );
    backdrop.append(modal);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) backdrop.remove();
    });
    document.body.append(backdrop);
  }

  function stageFakeAliExpressOrder() {
    const payload = ah.features.aliToWave.payload.createAliToWavePayload({
      orderId: `TEST-${Date.now()}`,
      orderDate: new Date().toISOString().slice(0, 10),
      cadAmount: "12.34",
      sourceUrl: "accounting-helpers-test"
    });
    payload.wave.vendor = ah.core.settings.get("wave.defaultAliExpressVendor", "") || "Aliexpress";
    const ok = ah.features.aliToWave.stageFromAliExpress.savePendingPayload(payload);
    ah.ui.toast.show(ok ? "Staged fake AliExpress order for Wave testing." : "Could not stage fake AliExpress order.", { tone: ok ? "success" : "error" });
  }

  function ensure() {
    if (!ah.sites.wave.detect.isWave()) return;
    let panel = document.getElementById("ah-wave-panel");
    if (!panel) {
      panel = ah.core.dom.el("div", { id: "ah-wave-panel" });
      Object.assign(panel.style, {
        alignItems: "center",
        background: "rgba(255,255,255,.94)",
        border: "1px solid rgba(0,0,0,.14)",
        borderRadius: "12px",
        bottom: "12px",
        boxShadow: "0 6px 20px rgba(0,0,0,.18)",
        display: "flex",
        font: "12px system-ui, sans-serif",
        gap: "12px",
        left: "50%",
        padding: "8px 12px",
        position: "fixed",
        transform: "translateX(-50%)",
        zIndex: "2147483645"
      });
      document.body.append(panel);
    }
    if (!panel.querySelector("[data-ah-wave-panel-title]")) {
      panel.append(ah.core.dom.el("strong", { "data-ah-wave-panel-title": "1" }, `Wave Helpers ${ah.core.constants.version}`));
    } else {
      panel.querySelector("[data-ah-wave-panel-title]").textContent = `Wave Helpers ${ah.core.constants.version}`;
    }
    if (!panelClicksEl) {
      panelClicksEl = ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        style: "min-height:28px;padding:5px 8px;",
        onclick: openDashboard
      });
      panel.append(panelClicksEl);
    }
    if (!panel.querySelector("[data-ah-open-settings]")) {
      panel.append(ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        "data-ah-open-settings": "1",
        style: "min-height:28px;padding:5px 8px;",
        title: "Open Accounting Helpers settings, including local Account 1 and Account 2 setup.",
        onclick: () => ah.ui.settingsModal.open()
      }, "Settings"));
    }
    if (!panel.querySelector("[data-ah-stage-fake-ali]")) {
      panel.append(ah.core.dom.el("button", {
        type: "button",
        class: "ah-button ah-button-secondary",
        "data-ah-stage-fake-ali": "1",
        style: "min-height:28px;padding:5px 8px;",
        title: "Stage a fake AliExpress order for testing the Wave create-and-fill workflow.",
        onclick: stageFakeAliExpressOrder
      }, "Stage fake Ali"));
    }
    updateSavingsUI();
  }

  ah.features.waveSavingsDashboard.ensure = ensure;
  ah.features.waveSavingsDashboard.addClicks = addClicks;
  ah.features.waveSavingsDashboard.state = state;
})();
