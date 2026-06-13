(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.sites = ah.sites || {};
  ah.sites.wave = ah.sites.wave || {};

  const HEARTBEAT_INTERVAL_MS = 15000;
  const HEARTBEAT_RECENT_MS = 45000;
  const PRESENCE_REQUEST_WAIT_MS = 1200;
  const key = ah.core.constants.storageKeys.waveHeartbeat;
  const requestKey = ah.core.constants.storageKeys.wavePresenceRequest;
  let timer = null;
  let listening = false;

  function write(responseTo) {
    ah.core.storage.set(key, {
      timestamp: Date.now(),
      url: location.href,
      responseTo: typeof responseTo === "string" ? responseTo : ""
    });
  }

  function read() {
    return ah.core.storage.get(key, null);
  }

  function isRecent() {
    const heartbeat = read();
    return !!(heartbeat?.timestamp && Date.now() - Number(heartbeat.timestamp) <= HEARTBEAT_RECENT_MS);
  }

  function requestId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function hasFreshResponse(id, startedAt) {
    const heartbeat = read();
    const timestamp = Number(heartbeat?.timestamp || 0);
    return !!(timestamp >= startedAt && (heartbeat.responseTo === id || Date.now() - timestamp <= HEARTBEAT_RECENT_MS));
  }

  function requestRecent(timeout) {
    if (isRecent()) return Promise.resolve(true);
    const id = requestId();
    const startedAt = Date.now();
    if (!ah.core.storage.set(requestKey, { id, timestamp: startedAt, url: location.href })) {
      return Promise.resolve(isRecent());
    }
    return new Promise((resolve) => {
      const until = startedAt + (timeout || PRESENCE_REQUEST_WAIT_MS);
      const tick = () => {
        if (hasFreshResponse(id, startedAt)) {
          resolve(true);
          return;
        }
        if (Date.now() >= until) {
          resolve(false);
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  function listenForPresenceRequests() {
    if (listening || typeof ah.core.storage.onChange !== "function") return;
    listening = true;
    ah.core.storage.onChange(requestKey, (request, oldRequest) => {
      if (!ah.sites.wave.detect.isWave()) return;
      if (!request?.id || request.id === oldRequest?.id) return;
      write(request.id);
    });
  }

  function ensure() {
    if (!ah.sites.wave.detect.isWave()) return;
    write();
    listenForPresenceRequests();
    if (timer) return;
    timer = setInterval(write, HEARTBEAT_INTERVAL_MS);
    window.addEventListener("beforeunload", () => write());
  }

  ah.sites.wave.heartbeat = { ensure, isRecent, read, requestRecent };
})();
