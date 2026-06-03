(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.aliexpress = ah.sites.aliexpress || {};

  ah.sites.aliexpress.detect = {
    isAliExpress() {
      return /(^|\.)aliexpress\.com$/i.test(location.hostname);
    },
    isOrderPage() {
      return this.isAliExpress() && /\/p\/order\/index\.html/i.test(location.pathname);
    },
    isCartPage() {
      return this.isAliExpress() && /\/p\/shoppingcart\/index\.html/i.test(location.pathname);
    }
  };
})();
