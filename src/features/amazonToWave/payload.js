(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.amazonToWave = ah.features.amazonToWave || {};

  const AMAZON_TO_WAVE_PAYLOAD_VERSION = 1;

  function createSuggestedDescription(order) {
    const productTitle = ah.sites.amazon.extractOrder.primaryProductTitle(order);
    const originalMerchant = "AMAZONCOM PAYMENTS-CA";
    return {
      originalMerchant,
      productTitle,
      suggested: productTitle ? `${originalMerchant} | ${productTitle}` : originalMerchant
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
        suggested: `AMAZONCOM PAYMENTS-CA | ${title}`
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
    createAmazonToWavePayload,
    isValidPayload,
    fakePayload
  };
})();
