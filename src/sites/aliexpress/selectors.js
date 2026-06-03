(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.aliexpress = ah.sites.aliexpress || {};

  ah.sites.aliexpress.selectors = {
    orderContainers: "[class*='order'], [data-order-id], [data-spm], .order-item",
    cartItems: "[class*='cart'], [class*='product'], [data-sku], [data-product-id]",
    priceText: "*"
  };
})();
