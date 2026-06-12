(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  const HEARTBEAT_INTERVAL_MS = 15000;
  const HEARTBEAT_RECENT_MS = 45000;
  const key = ah.core.constants.storageKeys.waveHeartbeat;
  let timer = null;

  function write() {
    ah.core.storage.set(key, {
      timestamp: Date.now(),
      url: location.href
    });
  }

  function read() {
    return ah.core.storage.get(key, null);
  }

  function isRecent() {
    const heartbeat = read();
    return !!(heartbeat?.timestamp && Date.now() - Number(heartbeat.timestamp) <= HEARTBEAT_RECENT_MS);
  }

  function ensure() {
    if (!ah.sites.wave.detect.isWave()) return;
    write();
    if (timer) return;
    timer = setInterval(write, HEARTBEAT_INTERVAL_MS);
    window.addEventListener("beforeunload", write);
  }

  ah.sites.wave.heartbeat = { ensure, isRecent, read };
})();
