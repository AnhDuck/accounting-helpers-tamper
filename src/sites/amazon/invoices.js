(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.amazon = ah.sites.amazon || {};

  const invoiceInfoPromiseByCard = new WeakMap();
  let prefetchCounter = 0;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function parsePopoverData(str) {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch (_error) {
      const match = str.match(/"url"\s*:\s*"([^"]+)"/);
      return match?.[1] ? { url: match[1] } : null;
    }
  }

  function toAbsoluteUrl(href) {
    try {
      return new URL(href, location.origin).toString();
    } catch (_error) {
      return null;
    }
  }

  function getOrderHeaderEl(orderCardEl) {
    const selectors = ah.sites.amazon.selectors;
    return orderCardEl.querySelector(selectors.orderHeader) || orderCardEl;
  }

  function getPopoverElForCard(orderCardEl) {
    const selectors = ah.sites.amazon.selectors;
    const headerEl = getOrderHeaderEl(orderCardEl);
    return headerEl.querySelector(selectors.invoicePopoverSpan) || orderCardEl.querySelector(selectors.invoicePopoverSpan);
  }

  function getPopoverUrlForCard(orderCardEl) {
    const popSpan = getPopoverElForCard(orderCardEl);
    const popData = parsePopoverData(popSpan?.getAttribute("data-a-popover"));
    return popData?.url ? toAbsoluteUrl(popData.url) : null;
  }

  function getOrderIdFromPopoverUrl(absPopoverUrl) {
    try {
      return new URL(absPopoverUrl).searchParams.get("orderId") || "";
    } catch (_error) {
      return "";
    }
  }

  function extractInvoiceUrlsFromHtml(htmlText) {
    const doc = new DOMParser().parseFromString(htmlText, "text/html");
    const anchors = Array.from(doc.querySelectorAll("a.a-link-normal[href], a[href]"));
    const pdfUrls = new Set();
    const fallbackUrls = new Set();
    anchors.forEach((anchor) => {
      const href = anchor.getAttribute("href") || "";
      const text = ah.core.dom.text(anchor);
      const looksLikeInvoicePdf = /invoice\.pdf/i.test(href);
      const looksLikeInvoiceText = /^invoice\b/i.test(text);
      if (looksLikeInvoicePdf) {
        const abs = toAbsoluteUrl(href);
        if (abs) pdfUrls.add(abs);
      } else if (looksLikeInvoiceText) {
        const abs = toAbsoluteUrl(href);
        if (abs) fallbackUrls.add(abs);
      }
    });
    return pdfUrls.size ? Array.from(pdfUrls) : Array.from(fallbackUrls);
  }

  function fetchInvoiceInfo(orderCardEl) {
    const absPopoverUrl = getPopoverUrlForCard(orderCardEl);
    if (!absPopoverUrl) {
      return Promise.resolve({
        popoverUrl: "",
        orderId: "",
        invoiceUrls: [],
        invoicePopoverFound: false
      });
    }
    const existing = invoiceInfoPromiseByCard.get(orderCardEl);
    if (existing) return existing;
    const delay = 120 + (prefetchCounter++ % 12) * 80;
    const promise = (async () => {
      await sleep(delay);
      try {
        const response = await fetch(absPopoverUrl, { credentials: "include" });
        const text = await response.text();
        const invoiceUrls = extractInvoiceUrlsFromHtml(text);
        return {
          popoverUrl: absPopoverUrl,
          orderId: getOrderIdFromPopoverUrl(absPopoverUrl),
          invoiceUrls,
          invoicePopoverFound: true
        };
      } catch (error) {
        ah.core.logger?.warn("Amazon invoice popover fetch failed", { message: String(error) });
        return {
          popoverUrl: absPopoverUrl,
          orderId: getOrderIdFromPopoverUrl(absPopoverUrl),
          invoiceUrls: [],
          invoicePopoverFound: true,
          error: String(error)
        };
      }
    })();
    invoiceInfoPromiseByCard.set(orderCardEl, promise);
    return promise;
  }

  function openTab(url, active) {
    try {
      if (typeof GM_openInTab === "function") {
        GM_openInTab(url, { active: !!active, insert: true, setParent: true });
        return true;
      }
    } catch (_error) {
      // Fall back to window.open below.
    }
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }

  function safeFilename(name) {
    return String(name || "Amazon_Invoice.pdf").replace(/[\\/:*?"<>|]+/g, "_");
  }

  function anchorDownload(url, filename) {
    try {
      const anchor = ah.core.dom.el("a", { href: url, download: filename, style: { display: "none" } });
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    } catch (_error) {
      // Best-effort only.
    }
  }

  function downloadInvoice(url, orderIdMaybe) {
    const name = safeFilename(orderIdMaybe ? `Amazon_Invoice_${orderIdMaybe}.pdf` : "Amazon_Invoice.pdf");
    try {
      if (typeof GM_download === "function") {
        GM_download({ url, name, saveAs: false, onerror: () => anchorDownload(url, name) });
        return;
      }
    } catch (_error) {
      // Fall through to anchor download.
    }
    anchorDownload(url, name);
  }

  ah.sites.amazon.invoices = {
    getOrderHeaderEl,
    getPopoverElForCard,
    getPopoverUrlForCard,
    extractInvoiceUrlsFromHtml,
    fetchInvoiceInfo,
    openTab,
    downloadInvoice
  };
})();
