(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  function dispatchInputEvents(input) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setReactInputValue(input, value) {
    if (!input) return false;
    const tag = input.tagName;
    const proto =
      tag === "TEXTAREA" ? HTMLTextAreaElement.prototype :
      tag === "SELECT" ? HTMLSelectElement.prototype :
      HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

    if (setter) setter.call(input, value);
    else input.value = value;

    dispatchInputEvents(input);
    return true;
  }

  function setContentEditableValue(node, value) {
    if (!node) return false;
    node.focus();
    node.textContent = value;
    dispatchInputEvents(node);
    return true;
  }

  function setFieldValue(field, value) {
    if (!field) return false;
    if (field.getAttribute("contenteditable") === "true") return setContentEditableValue(field, value);
    return setReactInputValue(field, value);
  }

  ah.core.react = { setReactInputValue, setContentEditableValue, setFieldValue };
})();
