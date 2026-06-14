(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.features = ah.features || {};
  ah.features.amazonOrders = ah.features.amazonOrders || {};

  function setButtonTempText(button, text, ms) {
    const old = button.textContent;
    button.textContent = text;
    button.disabled = true;
    setTimeout(() => {
      button.textContent = old;
      button.disabled = false;
    }, ms || 900);
  }

  function copyTextForItem(itemEl, titleLink) {
    const rawTitle = ah.core.dom.text(titleLink);
    const { title } = ah.sites.amazon.extractOrder.truncateTitle(rawTitle, ah.sites.amazon.extractOrder.TITLE_MAX_CHARS);
    const qty = ah.sites.amazon.extractOrder.getItemQuantity(itemEl);
    return qty > 1 ? `${qty}x ${title}` : title;
  }

  async function copyItemTitle(itemEl, titleLink, button) {
    const text = copyTextForItem(itemEl, titleLink);
    if (!text) {
      setButtonTempText(button, "No title", 900);
      return;
    }
    const ok = await ah.core.clipboard.writeText(text);
    setButtonTempText(button, ok ? "Copied" : "Copy failed", 900);
    ah.ui.toast.show(ok ? "Amazon product title copied." : "Could not copy Amazon product title.", { tone: ok ? "success" : "warn" });
  }

  function ensureCopyButtonForItem(itemEl) {
    if (!itemEl || itemEl.querySelector(":scope .ah-amz-copy-title")) return;
    const titleLink = ah.sites.amazon.extractOrder.findProductTitleLink(itemEl);
    if (!titleLink) return;
    const parent = titleLink.parentElement;
    if (!parent) return;
    parent.classList.add("ah-amz-title-line");
    const copyButton = button("Copy title", "ah-amz-copy-title ah-button-secondary", "Copy this Amazon product title, including quantity when available.", (btn) => copyItemTitle(itemEl, titleLink, btn));
    parent.insertBefore(copyButton, titleLink);
  }

  function ensureCopyButtons(orderCardEl) {
    const items = ah.core.dom.qsa(ah.sites.amazon.selectors.itemRow, orderCardEl)
      .filter((item) => ah.sites.amazon.extractOrder.findProductTitleLink(item));
    if (items.length) {
      items.forEach(ensureCopyButtonForItem);
      return;
    }
    ah.core.dom.qsa(ah.sites.amazon.selectors.productLinkWithinItem, orderCardEl).forEach((titleLink) => {
      const itemEl = titleLink.closest("div, li, article") || orderCardEl;
      ensureCopyButtonForItem(itemEl);
    });
  }

  async function openInvoices(orderCardEl, button) {
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Opening...";
    try {
      const info = await ah.sites.amazon.invoices.fetchInvoiceInfo(orderCardEl);
      const urls = info?.invoiceUrls || [];
      if (!urls.length) {
        button.textContent = "No invoices";
        await new Promise((resolve) => setTimeout(resolve, 900));
        return;
      }
      urls.forEach((url) => ah.sites.amazon.invoices.openTab(url, false));
      button.textContent = urls.length === 1 ? "Opened" : `Opened ${urls.length}`;
      await new Promise((resolve) => setTimeout(resolve, 900));
    } finally {
      button.textContent = oldText;
      button.disabled = false;
    }
  }

  async function openAndDownloadInvoice(orderCardEl, button) {
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Opening...";
    try {
      const info = await ah.sites.amazon.invoices.fetchInvoiceInfo(orderCardEl);
      const urls = info?.invoiceUrls || [];
      if (urls.length !== 1) {
        button.textContent = urls.length ? "Not single" : "No invoices";
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return;
      }
      ah.sites.amazon.invoices.openTab(urls[0], true);
      ah.sites.amazon.invoices.downloadInvoice(urls[0], info?.orderId || ah.sites.amazon.extractOrder.extractOrderId(orderCardEl));
      button.textContent = "Done";
      await new Promise((resolve) => setTimeout(resolve, 900));
    } finally {
      button.textContent = oldText;
      button.disabled = false;
    }
  }

  function button(label, className, title, onClick) {
    return ah.core.dom.el("button", {
      type: "button",
      class: `ah-button ${className || ""}`.trim(),
      title,
      onclick: (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick(event.currentTarget);
      }
    }, label);
  }

  function ensureOrderCard(orderCardEl) {
    if (!orderCardEl || orderCardEl.querySelector("[data-ah-amazon-helper='true']")) return;
    const header = ah.sites.amazon.invoices.getOrderHeaderEl(orderCardEl);
    const row = ah.core.dom.el("div", {
      class: "ah-amz-order-row",
      "data-ah-amazon-helper": "true"
    });
    const stageButton = button("Stage for Wave", "ah-amz-stage-wave", "Stage this Amazon order so it can enrich an existing imported Wave transaction.", (btn) => {
      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Staging...";
      ah.features.amazonToWave.stageFromAmazon.stageOrder(orderCardEl).finally(() => {
        btn.textContent = old;
        btn.disabled = false;
      });
    });
    const openButton = button("Open invoice", "ah-amz-open-invoice ah-button-secondary", "Open invoice PDF(s) for this order in new tabs.", (btn) => openInvoices(orderCardEl, btn));
    const downloadButton = button("Open & download invoice", "ah-amz-download-invoice ah-button-secondary", "Open the single invoice in a focused tab and attempt to download it.", (btn) => openAndDownloadInvoice(orderCardEl, btn));
    row.append(stageButton, openButton, downloadButton);

    const insertAfter = header && orderCardEl.contains(header) ? header : null;
    if (insertAfter?.parentElement) {
      insertAfter.insertAdjacentElement("afterend", row);
    } else {
      orderCardEl.prepend(row);
    }

    ah.sites.amazon.invoices.fetchInvoiceInfo(orderCardEl).then((info) => {
      if (!row.isConnected) return;
      const count = info?.invoiceUrls?.length || 0;
      openButton.textContent = count === 1 ? "Open invoice" : "Open all invoices";
      downloadButton.hidden = count !== 1;
      row.dataset.ahInvoiceCount = String(count);
    });
  }

  function ensure() {
    if (!ah.sites.amazon.detect.isOrdersPage()) return;
    ah.ui.styles.ensureStyles();
    ah.sites.amazon.extractOrder.findOrderCards(document).forEach((orderCard) => {
      ensureOrderCard(orderCard);
      ensureCopyButtons(orderCard);
    });
  }

  function diagnostics() {
    const cards = ah.sites.amazon.extractOrder.findOrderCards(document);
    const firstCard = cards[0] || null;
    const firstOrder = firstCard ? {
      orderIdFound: !!ah.sites.amazon.extractOrder.extractOrderId(firstCard),
      orderDateFound: !!ah.sites.amazon.extractOrder.extractOrderDate(firstCard),
      amountFound: !!ah.sites.amazon.extractOrder.extractAmount(firstCard).value,
      productsFound: ah.sites.amazon.extractOrder.extractProducts(firstCard).length,
      invoicePopoverFound: !!ah.sites.amazon.invoices.getPopoverElForCard(firstCard),
      invoiceUrlsFound: Number(firstCard.querySelector(".ah-amz-order-row")?.dataset?.ahInvoiceCount || 0)
    } : null;
    return {
      isAmazon: !!ah.sites.amazon.detect.isAmazon(),
      isOrdersPage: !!ah.sites.amazon.detect.isOrdersPage(),
      orderCardsFound: cards.length,
      enhancedCards: cards.filter((card) => !!card.querySelector("[data-ah-amazon-helper='true']")).length,
      firstOrder,
      buttons: {
        copyTitleInjected: !!document.querySelector(".ah-amz-copy-title"),
        stageForWaveInjected: !!document.querySelector(".ah-amz-stage-wave"),
        invoiceButtonsInjected: !!document.querySelector(".ah-amz-open-invoice")
      },
      errors: [],
      warnings: []
    };
  }

  ah.features.amazonOrders = { ensure, diagnostics };
})();
