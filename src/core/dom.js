(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function text(node) {
    return (node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function el(tagName, attrs, children) {
    const node = document.createElement(tagName);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key === "class") node.className = value;
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
      else if (value !== null && value !== undefined) node.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => {
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function findByText(root, selector, matcher) {
    const normalized = typeof matcher === "string" ? matcher.toLowerCase() : null;
    return qsa(selector, root).find((node) => {
      const value = text(node).toLowerCase();
      return normalized ? value.includes(normalized) : matcher(value, node);
    });
  }

  function visible(nodes) {
    return nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
  }

  function isEditable(node) {
    return node && ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName);
  }

  function getLabelText(field) {
    const id = field.getAttribute("id");
    const labels = [];
    if (id) labels.push(...qsa(`label[for="${CSS.escape(id)}"]`));
    labels.push(field.closest("label"));
    labels.push(field.closest("[aria-label]"));
    labels.push(field.closest("[data-testid]"));
    return labels.map(text).join(" ").toLowerCase();
  }

  function findFieldByLabel(root, labels) {
    const needles = (Array.isArray(labels) ? labels : [labels]).map((label) => label.toLowerCase());
    const fields = visible(qsa("input, textarea, select, [contenteditable='true'], [role='combobox']", root));
    return fields.find((field) => {
      const haystack = [
        field.getAttribute("name"),
        field.getAttribute("placeholder"),
        field.getAttribute("aria-label"),
        field.getAttribute("data-testid"),
        getLabelText(field)
      ].filter(Boolean).join(" ").toLowerCase();
      return needles.some((needle) => haystack.includes(needle));
    });
  }

  function waitFor(selectorOrFn, options) {
    const timeout = options?.timeout || 8000;
    const interval = options?.interval || 100;
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        const result = typeof selectorOrFn === "function" ? selectorOrFn() : qs(selectorOrFn);
        if (result) {
          resolve(result);
          return;
        }
        if (Date.now() - started > timeout) {
          reject(new Error(`Timed out waiting for ${selectorOrFn}`));
          return;
        }
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  ah.core.dom = { qs, qsa, text, el, findByText, visible, isEditable, findFieldByLabel, waitFor };
})();
