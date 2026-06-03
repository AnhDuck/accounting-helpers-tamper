(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  function toIsoDate(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  function parseLooseDate(value) {
    if (!value) return "";
    const cleaned = String(value).replace(/\s+/g, " ").trim();
    const date = new Date(cleaned);
    if (!Number.isNaN(date.getTime())) return toIsoDate(date);

    const numeric = cleaned.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})|(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (!numeric) return "";
    if (numeric[1]) return `${numeric[1]}-${numeric[2].padStart(2, "0")}-${numeric[3].padStart(2, "0")}`;
    return `${numeric[6]}-${numeric[4].padStart(2, "0")}-${numeric[5].padStart(2, "0")}`;
  }

  ah.core.dates = { toIsoDate, parseLooseDate };
})();
