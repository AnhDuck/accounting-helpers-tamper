(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.ui = ah.ui || {};

  const defaultTimeout = 11000;
  const toneTitles = {
    success: "Done",
    warn: "Needs attention",
    error: "Error"
  };

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

  function shouldShowTitle(message, options) {
    return !!options?.title || !!options?.tone || String(message || "").length > 90;
  }

  function toastTitle(message, options) {
    if (options?.title) return options.title;
    if (String(message || "").startsWith("Partially filled Wave transaction")) return "Partial fill";
    return toneTitles[options?.tone] || "Accounting Helpers";
  }

  function show(message, options) {
    const layer = ensureToastLayer();
    const tone = options?.tone || "success";
    const toast = document.createElement("div");
    toast.className = `ah-toast ah-toast-${tone}`;
    toast.setAttribute("role", tone === "error" || tone === "warn" ? "alert" : "status");

    const icon = document.createElement("span");
    icon.className = "ah-toast-icon";
    icon.setAttribute("aria-hidden", "true");

    const copy = document.createElement("div");
    copy.className = "ah-toast-copy";

    if (shouldShowTitle(message, options)) {
      const title = document.createElement("strong");
      title.className = "ah-toast-title";
      title.textContent = toastTitle(message, options);
      copy.append(title);
    }

    const body = document.createElement("div");
    body.className = "ah-toast-body";
    body.textContent = message;
    copy.append(body);

    toast.append(icon, copy);
    layer.append(toast);

    const timeout = options?.timeout === undefined ? defaultTimeout : options.timeout;
    if (timeout > 0) {
      let remaining = timeout;
      let started = Date.now();
      let timer = setTimeout(() => toast.remove(), remaining);
      toast.addEventListener("mouseenter", () => {
        clearTimeout(timer);
        remaining -= Date.now() - started;
      });
      toast.addEventListener("mouseleave", () => {
        started = Date.now();
        timer = setTimeout(() => toast.remove(), Math.max(1000, remaining));
      });
    }
    return toast;
  }

  ah.ui.toast = { ensureToastLayer, show };
})();
