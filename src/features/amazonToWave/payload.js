(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.amazonToWave = ah.features.amazonToWave || {};

  const AMAZON_TO_WAVE_PAYLOAD_VERSION = 1;
  const WAVE_DESCRIPTION_MAX_CHARS = 255;

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function truncate(value, maxChars) {
    const text = normalize(value);
    if (!Number.isFinite(maxChars) || maxChars <= 0) return "";
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  }

  function productLabel(product) {
    const title = normalize(product?.title);
    if (!title) return "";
    const qty = Number(product?.qty);
    return qty > 1 ? `${qty}x ${title}` : title;
  }

  function productTitleSummary(order, prefixChars) {
    const products = Array.isArray(order?.products) ? order.products : [];
    const separator = " | ";
    const maxChars = WAVE_DESCRIPTION_MAX_CHARS - Number(prefixChars || 0);
    let summary = "";
    for (const product of products) {
      const label = productLabel(product);
      if (!label) continue;
      const next = summary ? `${summary}${separator}${label}` : label;
      if (next.length <= maxChars) {
        summary = next;
        continue;
      }
      const remaining = maxChars - summary.length - (summary ? separator.length : 0);
      if (remaining > 0) summary = summary ? `${summary}${separator}${truncate(label, remaining)}` : truncate(label, maxChars);
      break;
    }
    return truncate(summary, maxChars);
  }

  function createSuggestedDescription(order) {
    const originalMerchant = "AMAZONCOM PAYMENTS-CA";
    const productTitle = productTitleSummary(order, originalMerchant.length + 3);
    const suggested = productTitle ? `${originalMerchant} | ${productTitle}` : originalMerchant;
    return {
      originalMerchant,
      productTitle,
      suggested: truncate(suggested, WAVE_DESCRIPTION_MAX_CHARS),
      maxChars: WAVE_DESCRIPTION_MAX_CHARS
    };
  }

  function createAmazonToWavePayload(order) {
    const description = createSuggestedDescription(order);
    return {
      version: AMAZON_TO_WAVE_PAYLOAD_VERSION,
      source: "amazon",
      target: "wave",
      mode: "edit-existing-transaction",
      orderId: String(order?.orderId || ""),
      orderDate: order?.orderDate || "",
      amount: {
        value: Number(order?.amount?.value).toFixed(2),
        currency: order?.amount?.currency || "CAD"
      },
      description,
      products: Array.isArray(order?.products) ? order.products : [],
      invoice: {
        count: Number(order?.invoice?.count || 0),
        urls: Array.isArray(order?.invoice?.urls) ? order.invoice.urls : []
      },
      sourceUrl: order?.sourceUrl || location.href,
      createdAt: Date.now()
    };
  }

  function isValidPayload(payload) {
    const amount = Number(payload?.amount?.value);
    return !!(
      payload &&
      payload.version === AMAZON_TO_WAVE_PAYLOAD_VERSION &&
      payload.source === "amazon" &&
      payload.target === "wave" &&
      payload.mode === "edit-existing-transaction" &&
      payload.orderId &&
      Number.isFinite(amount)
    );
  }

  function fakePayload() {
    const title = "Spartan Industrial - 3\" X 5\" (200 Count) 2 Mil Clear Reclosable Zip Plastic Poly Bags with Resealable Lock Seal Zipper";
    return {
      version: AMAZON_TO_WAVE_PAYLOAD_VERSION,
      source: "amazon",
      target: "wave",
      mode: "edit-existing-transaction",
      orderId: "TEST-AMZ-ORDER-001",
      orderDate: new Date().toISOString().slice(0, 10),
      amount: {
        value: "18.83",
        currency: "CAD"
      },
      description: {
        originalMerchant: "AMAZONCOM PAYMENTS-CA",
        productTitle: title,
        suggested: `AMAZONCOM PAYMENTS-CA | ${title}`,
        maxChars: WAVE_DESCRIPTION_MAX_CHARS
      },
      products: [
        {
          qty: 1,
          title
        }
      ],
      invoice: {
        count: 1,
        urls: []
      },
      sourceUrl: "accounting-helpers-test",
      createdAt: Date.now(),
      debug: { fake: true, autoFillSuppressed: true }
    };
  }

  ah.features.amazonToWave.payload = {
    AMAZON_TO_WAVE_PAYLOAD_VERSION,
    WAVE_DESCRIPTION_MAX_CHARS,
    createAmazonToWavePayload,
    isValidPayload,
    fakePayload
  };
})();
