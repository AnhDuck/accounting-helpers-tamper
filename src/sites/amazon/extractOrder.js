(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.amazon = ah.sites.amazon || {};

  const TITLE_MAX_CHARS = 155;
  const ORDER_ID_RE = /\b\d{3}-\d{7}-\d{7}\b/;

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function truncateTitle(title, maxChars) {
    const value = normalizeText(title);
    if (value.length > maxChars) return { title: value.slice(0, maxChars), didTrim: true };
    return { title: value, didTrim: false };
  }

  function findOrderCards(root) {
    return ah.core.dom.qsa(ah.sites.amazon.selectors.orderCard, root || document)
      .filter((card) => {
        const rect = card.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        return ORDER_ID_RE.test(card.textContent || "") || !!ah.sites.amazon.invoices?.getPopoverElForCard?.(card);
      })
      .filter((card, index, cards) => cards.findIndex((candidate) => candidate === card || candidate.contains(card)) === index);
  }

  function findProductTitleLink(itemEl) {
    const links = ah.core.dom.qsa(ah.sites.amazon.selectors.productLinkWithinItem, itemEl)
      .filter((link) => normalizeText(link.textContent));
    links.sort((a, b) => normalizeText(b.textContent).length - normalizeText(a.textContent).length);
    return links[0] || null;
  }

  function getItemQuantity(itemEl) {
    const qEl = itemEl.querySelector(ah.sites.amazon.selectors.qtyEl);
    if (qEl) {
      const number = Number.parseInt(normalizeText(qEl.textContent).replace(/[^\d]/g, ""), 10);
      if (Number.isFinite(number) && number > 0) return number;
    }
    const text = normalizeText(itemEl.textContent);
    const match = text.match(/\b(?:Qty|Quantity)\s*[:x]?\s*(\d+)\b/i);
    if (match?.[1]) {
      const number = Number.parseInt(match[1], 10);
      if (Number.isFinite(number) && number > 0) return number;
    }
    return 1;
  }

  function extractProducts(orderCardEl) {
    const selectors = ah.sites.amazon.selectors;
    const rows = ah.core.dom.qsa(selectors.itemRow, orderCardEl);
    const products = [];
    const seen = new Set();
    rows.forEach((row) => {
      const titleLink = findProductTitleLink(row);
      const title = normalizeText(titleLink?.textContent);
      if (!title || seen.has(title)) return;
      seen.add(title);
      products.push({ qty: getItemQuantity(row), title });
    });
    if (products.length) return products;

    ah.core.dom.qsa(selectors.productLinkWithinItem, orderCardEl).forEach((link) => {
      const title = normalizeText(link.textContent);
      if (!title || seen.has(title)) return;
      seen.add(title);
      products.push({ qty: 1, title });
    });
    return products;
  }

  function extractOrderId(orderCardEl) {
    const dataId = orderCardEl.getAttribute("data-order-id") || orderCardEl.dataset?.orderId;
    if (ORDER_ID_RE.test(dataId || "")) return dataId.match(ORDER_ID_RE)[0];
    const popoverUrl = ah.sites.amazon.invoices?.getPopoverUrlForCard?.(orderCardEl) || "";
    const fromPopover = popoverUrl.match(/[?&]orderId=([^&]+)/)?.[1];
    if (fromPopover && ORDER_ID_RE.test(decodeURIComponent(fromPopover))) return decodeURIComponent(fromPopover).match(ORDER_ID_RE)[0];
    const text = normalizeText(orderCardEl.textContent);
    return text.match(ORDER_ID_RE)?.[0] || "";
  }

  function parseAmazonDate(raw) {
    const value = normalizeText(raw);
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return "";
    return new Date(parsed).toISOString().slice(0, 10);
  }

  function extractOrderDate(orderCardEl) {
    const text = normalizeText(orderCardEl.textContent);
    const labeled = text.match(/Order\s+placed\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i);
    if (labeled?.[1]) return parseAmazonDate(labeled[1]);
    const date = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/i);
    return date?.[0] ? parseAmazonDate(date[0]) : "";
  }

  function inferCurrency(text) {
    const haystack = `${text || ""} ${location.hostname}`;
    if (/£|GBP|amazon\.co\.uk/i.test(haystack)) return "GBP";
    if (/CA\$|CDN\$|CAD|amazon\.ca/i.test(haystack)) return "CAD";
    if (/US\$|USD|amazon\.com/i.test(haystack)) return "USD";
    return "CAD";
  }

  function extractAmount(orderCardEl) {
    const text = normalizeText(orderCardEl.textContent);
    const totalMatch = text.match(/(?:Order\s+total|Total)\s*[:\-]?\s*((?:CA\$|CDN\$|US\$|CAD|USD|GBP|£|\$)\s*[\d,]+(?:\.\d{2})?)/i);
    const fallbackMatch = text.match(/(?:CA\$|CDN\$|US\$|CAD|USD|GBP|£|\$)\s*[\d,]+(?:\.\d{2})?/i);
    const raw = totalMatch?.[1] || fallbackMatch?.[0] || "";
    const value = ah.core.money.parseMoney(raw);
    return {
      value: value === null ? "" : value.toFixed(2),
      currency: inferCurrency(raw || text)
    };
  }

  function primaryProductTitle(order, maxChars) {
    const products = order?.products || [];
    if (!products.length) return "";
    const first = truncateTitle(products[0].title, maxChars || TITLE_MAX_CHARS).title;
    if (products.length > 1) return `${products.length} items | ${first}`;
    return first;
  }

  function copyTitleTextForOrder(order, maxChars) {
    const products = order?.products || [];
    if (!products.length) return "";
    const title = primaryProductTitle(order, maxChars || TITLE_MAX_CHARS);
    const qty = Number(products[0].qty);
    return qty > 1 && products.length === 1 ? `${qty}x ${title}` : title;
  }

  async function extractOrder(orderCardEl, options) {
    const products = extractProducts(orderCardEl);
    const amount = extractAmount(orderCardEl);
    const invoiceInfo = options?.includeInvoice === false ? null : await ah.sites.amazon.invoices.fetchInvoiceInfo(orderCardEl);
    const orderId = extractOrderId(orderCardEl) || invoiceInfo?.orderId || "";
    return {
      orderId,
      orderDate: extractOrderDate(orderCardEl),
      amount,
      products,
      invoice: {
        count: invoiceInfo?.invoiceUrls?.length || 0,
        urls: invoiceInfo?.invoiceUrls || []
      },
      sourceUrl: location.href
    };
  }

  ah.sites.amazon.extractOrder = {
    TITLE_MAX_CHARS,
    truncateTitle,
    findOrderCards,
    findProductTitleLink,
    getItemQuantity,
    extractProducts,
    extractOrderId,
    extractOrderDate,
    extractAmount,
    primaryProductTitle,
    copyTitleTextForOrder,
    extractOrder
  };
})();
