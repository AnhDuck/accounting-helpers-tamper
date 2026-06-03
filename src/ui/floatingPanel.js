(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.ui = ah.ui || {};

  function ensure(id, render) {
    let panel = document.getElementById(id);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = id;
      panel.className = "ah-floating-panel";
      document.body.append(panel);
    }
    const content = render(panel);
    if (content) {
      panel.replaceChildren(content.nodeType ? content : document.createTextNode(String(content)));
    }
    return panel;
  }

  function remove(id) {
    document.getElementById(id)?.remove();
  }

  ah.ui.floatingPanel = { ensure, remove };
})();
