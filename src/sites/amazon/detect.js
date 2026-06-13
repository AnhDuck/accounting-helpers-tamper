(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.amazon = ah.sites.amazon || {};

  function isAmazon() {
    return /(^|\.)amazon\./i.test(location.hostname);
  }

  function isOrdersPage() {
    return isAmazon() && /(?:your-orders|order-history)/i.test(location.href);
  }

  ah.sites.amazon.detect = { isAmazon, isOrdersPage };
})();
