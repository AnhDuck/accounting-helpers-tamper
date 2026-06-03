(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.aliToWave = ah.features.aliToWave || {};

  const ALI_TO_WAVE_PAYLOAD_VERSION = 1;

  function createAliToWavePayload({ orderId, orderDate, cadAmount, sourceUrl }) {
    return {
      version: ALI_TO_WAVE_PAYLOAD_VERSION,
      source: "aliexpress",
      target: "wave",
      orderId,
      orderDate,
      amount: {
        value: Number(cadAmount).toFixed(2),
        currency: "CAD"
      },
      wave: {
        description: `Ali | ${orderId}`,
        vendor: null,
        account: null,
        category: null,
        type: null
      },
      sourceUrl,
      createdAt: Date.now()
    };
  }

  function isValidPayload(payload) {
    return !!(
      payload &&
      payload.version === ALI_TO_WAVE_PAYLOAD_VERSION &&
      payload.source === "aliexpress" &&
      payload.target === "wave" &&
      payload.orderId &&
      payload.amount?.value
    );
  }

  ah.features.aliToWave.payload = { ALI_TO_WAVE_PAYLOAD_VERSION, createAliToWavePayload, isValidPayload };
})();
