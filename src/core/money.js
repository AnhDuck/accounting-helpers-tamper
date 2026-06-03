(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  function parseMoney(value) {
    if (typeof value === "number") return value;
    if (!value) return null;
    const normalized = String(value)
      .replace(/,/g, "")
      .replace(/[^\d.\-()]/g, "")
      .replace(/^\((.*)\)$/, "-$1");
    const number = Number.parseFloat(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function roundCents(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function formatCurrency(value, currency) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    try {
      return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: currency || "CAD",
        currencyDisplay: "narrowSymbol"
      }).format(number);
    } catch (_error) {
      return `${currency || "CAD"} ${number.toFixed(2)}`;
    }
  }

  function extractFirstMoney(text) {
    const match = String(text || "").match(/(?:CA\$|US\$|\$)?\s*-?\d[\d,]*(?:\.\d{2})?/i);
    return match ? parseMoney(match[0]) : null;
  }

  ah.core.money = { parseMoney, roundCents, formatCurrency, extractFirstMoney };
})();
