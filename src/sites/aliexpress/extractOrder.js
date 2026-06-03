(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.aliexpress = ah.sites.aliexpress || {};

  function directOrderId(source) {
    if (!source) return "";
    const ownAttr = source.getAttribute?.("data-order-id");
    if (ownAttr) return ownAttr;
    const fromAttr = ah.core.dom.qsa("[data-order-id]", source).map((node) => node.getAttribute("data-order-id")).find(Boolean);
    if (fromAttr) return fromAttr;

    const bodyText = ah.core.dom.text(source);
    const labelMatch = bodyText.match(/(?:order\s*(?:id|number|no\.?)\s*[:#]?\s*)(\d{8,})/i);
    if (labelMatch) return labelMatch[1];
    const longNumber = bodyText.match(/\b\d{12,20}\b/);
    return longNumber ? longNumber[0] : "";
  }

  function hasOrderPayloadContext(source) {
    return !!source?.querySelector?.(".ah-send-to-wave, .ah-ae-cad-row, .ae-helper-cad-row, [data-ah-cad-total]");
  }

  function findOrderRoot(startNode) {
    const start = startNode?.nodeType === Node.ELEMENT_NODE ? startNode : startNode?.parentElement;
    const fallbackStart = start || document.querySelector(".ah-send-to-wave") || document.getElementById("ah-send-to-wave");
    for (let node = fallbackStart; node && node !== document.documentElement; node = node.parentElement) {
      if (directOrderId(node) && hasOrderPayloadContext(node)) return node;
    }

    const closestOrder = fallbackStart?.closest?.(ah.sites.aliexpress.selectors.orderContainers);
    if (directOrderId(closestOrder)) return closestOrder;

    return ah.core.dom.visible(ah.core.dom.qsa(ah.sites.aliexpress.selectors.orderContainers))
      .find((node) => directOrderId(node)) ||
      document.body;
  }

  function extractOrderId(root) {
    const source = root || findOrderRoot();
    return directOrderId(source);
  }

  function extractOrderDate(root) {
    const source = root || findOrderRoot();
    const bodyText = ah.core.dom.text(source);
    const labelMatch = bodyText.match(/(?:order\s*(?:date|time)|placed\s*on)\s*[:#]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i);
    return ah.core.dates.parseLooseDate(labelMatch?.[1]) || ah.core.dates.toIsoDate(new Date());
  }

  function extractUsdTotal(root) {
    const source = root || findOrderRoot();
    const text = ah.core.dom.text(source);
    const explicit = text.match(/(?:US\s*\$|USD\s*)\s*([0-9][\d,]*(?:\.\d{2})?)/i);
    if (explicit) return ah.core.money.parseMoney(explicit[1]);
    const totalLine = text.match(/(?:order\s*total|total)\s*(?:US\s*\$|\$|USD)?\s*([0-9][\d,]*(?:\.\d{2})?)/i);
    return totalLine ? ah.core.money.parseMoney(totalLine[1]) : null;
  }

  function extractCadTotal(root) {
    const source = root || findOrderRoot();
    const existing = [source, ...ah.core.dom.qsa("[data-ah-cad-total]", source)]
      .map((node) => node.getAttribute?.("data-ah-cad-total") || node.dataset?.value || ah.core.dom.text(node))
      .map((value) => ah.core.money.parseMoney(value))
      .find((value) => value !== null);
    if (existing !== undefined) return existing;
    const text = ah.core.dom.text(source);
    const cad = text.match(/(?:CA\s*\$|CAD\s*)\s*([0-9][\d,]*(?:\.\d{2})?)/i);
    return cad ? ah.core.money.parseMoney(cad[1]) : null;
  }

  function extractOrder() {
    const root = findOrderRoot();
    return {
      orderId: extractOrderId(root),
      orderDate: extractOrderDate(root),
      usdTotal: extractUsdTotal(root),
      cadTotal: extractCadTotal(root),
      sourceUrl: location.href,
      root
    };
  }

  ah.sites.aliexpress.extractOrder = { findOrderRoot, extractOrderId, extractOrderDate, extractUsdTotal, extractCadTotal, extractOrder };
})();
