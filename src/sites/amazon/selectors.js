(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.amazon = ah.sites.amazon || {};

  ah.sites.amazon.selectors = {
    orderCard: [
      "div.a-box-group",
      "div[id='orderCard']",
      "[data-order-id]"
    ].join(", "),
    orderHeader: [
      "#orderCardHeader",
      "div[id='orderCardHeader']",
      ".order-info",
      ".a-box-inner"
    ].join(", "),
    itemRow: [
      ".itemDetails",
      ".yohtmlc-item",
      ".a-fixed-left-grid",
      "[data-component='item']"
    ].join(", "),
    productLinkWithinItem: [
      "a.a-link-normal[href*='/dp/']",
      "a[href*='/dp/']",
      "a[href*='/gp/product/']"
    ].join(", "),
    qtyEl: [
      ".itemQuantity",
      "[class*='quantity']",
      "[aria-label*='Quantity']"
    ].join(", "),
    invoicePopoverSpan: "span.a-declarative[data-action='a-popover'][data-a-popover*='/your-orders/invoice/popover?orderId=']",
    helperRow: ".ah-amz-order-row"
  };
})();
