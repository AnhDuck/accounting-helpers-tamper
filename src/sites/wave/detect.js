(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  ah.sites.wave.detect = {
    isWave() {
      return location.hostname === "next.waveapps.com";
    },
    isTransactionsPage() {
      return this.isWave() && /transactions/i.test(location.pathname);
    }
  };
})();
