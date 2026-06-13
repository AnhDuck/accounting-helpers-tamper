(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  async function writeText(text) {
    const value = String(text || "");
    const errors = [];
    if (typeof GM_setClipboard === "function") {
      try {
        GM_setClipboard(value, "text");
        return true;
      } catch (error) {
        errors.push(`GM_setClipboard: ${String(error)}`);
      }
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (error) {
        errors.push(`navigator.clipboard: ${String(error)}`);
      }
    }
    try {
      const textarea = ah.core.dom.el("textarea", { style: { position: "fixed", left: "-9999px", top: "0" } }, value);
      document.body.append(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand?.("copy") || false;
      textarea.remove();
      if (ok) return true;
      errors.push("document.execCommand copy returned false");
    } catch (error) {
      errors.push(`document.execCommand: ${String(error)}`);
    }
    ah.core.logger?.warn("Clipboard copy failed", { errors });
    return false;
  }

  ah.core.clipboard = { writeText };
})();
