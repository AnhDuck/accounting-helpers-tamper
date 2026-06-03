(function () {
  const ah = window.AccountingHelpers = window.AccountingHelpers || {};
  ah.core = ah.core || {};

  const logs = [];
  const maxLogs = 200;

  function write(level, message, detail) {
    const entry = {
      level,
      message,
      detail: detail === undefined ? null : detail,
      at: new Date().toISOString()
    };
    logs.push(entry);
    while (logs.length > maxLogs) logs.shift();

    const consoleMethod = console[level] || console.log;
    consoleMethod.call(console, "[Accounting Helpers]", message, detail || "");
  }

  ah.core.logger = {
    debug(message, detail) {
      write("debug", message, detail);
    },
    info(message, detail) {
      write("info", message, detail);
    },
    warn(message, detail) {
      write("warn", message, detail);
    },
    error(message, detail) {
      write("error", message, detail);
    },
    getLogs() {
      return logs.slice();
    },
    clearLogs() {
      logs.length = 0;
    }
  };
})();
