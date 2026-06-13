(function () {
  const devConfig = window.AccountingHelpersDev || {};
  const devOrigin = devConfig.origin || "http://127.0.0.1:5173";
  const bundleUrl = devOrigin + "/accounting-helpers.dev-bundle.js";

  function withCacheBust(url) {
    return url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
  }

  function requestText(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: withCacheBust(url),
        headers: { "Cache-Control": "no-cache" },
        timeout: 10000,
        onload(response) {
          if (response.status >= 200 && response.status < 300) {
            resolve(response.responseText);
            return;
          }
          reject(new Error("HTTP " + response.status + " for " + url));
        },
        onerror() {
          reject(new Error("Network error for " + url));
        },
        ontimeout() {
          reject(new Error("Timeout loading " + url));
        }
      });
    });
  }

  function showLoadFailure(error) {
    console.error("[Accounting Helpers Dev] Failed to load local modules", error);
    const box = document.createElement("div");
    box.textContent = "Accounting Helpers Dev failed to load from " + devOrigin + ": " + error.message;
    box.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "left:12px",
      "bottom:12px",
      "max-width:520px",
      "padding:10px 12px",
      "border:1px solid #b91c1c",
      "background:#fef2f2",
      "color:#7f1d1d",
      "font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif",
      "box-shadow:0 8px 20px rgba(0,0,0,.18)"
    ].join(";");
    document.documentElement.appendChild(box);
  }

  async function loadLocalBundle() {
    const startedAt = performance.now();
    const source = await requestText(bundleUrl);
    new Function(source + "\n//# sourceURL=" + bundleUrl)();
    const duration = Math.round(performance.now() - startedAt);
    console.info("[Accounting Helpers Dev] Loaded local bundle from " + devOrigin + " in " + duration + "ms");
  }

  loadLocalBundle().catch(showLoadFailure);
})();
