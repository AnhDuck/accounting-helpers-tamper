(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  function rafThrottle(fn) {
    let pending = false;
    return function throttled(...args) {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        fn.apply(this, args);
      });
    };
  }

  ah.core.events = { rafThrottle };
})();
