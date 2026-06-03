(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.ui = ah.ui || {};

  function ensureToastLayer() {
    let layer = document.getElementById("ah-toast-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "ah-toast-layer";
      layer.className = "ah-toast-layer";
      document.body.append(layer);
    }
    return layer;
  }

  function show(message, options) {
    const layer = ensureToastLayer();
    const toast = document.createElement("div");
    toast.className = "ah-toast";
    toast.textContent = message;
    if (options?.tone === "error") toast.style.borderLeftColor = "#d85a4a";
    if (options?.tone === "warn") toast.style.borderLeftColor = "#c99023";
    layer.append(toast);
    setTimeout(() => toast.remove(), options?.timeout || 4200);
    return toast;
  }

  ah.ui.toast = { ensureToastLayer, show };
})();
