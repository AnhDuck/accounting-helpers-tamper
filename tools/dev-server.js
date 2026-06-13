const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const buildReleasePath = require.resolve("./build-release");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 5173);
const root = path.resolve(__dirname, "..");
const allowedRoots = ["src", "userscript", "dist"];

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"]
]);

function headers(contentType) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": contentType
  };
}

function send(response, status, contentType, body) {
  response.writeHead(status, headers(contentType));
  response.end(body);
}

function currentSourceFiles() {
  delete require.cache[buildReleasePath];
  return require("./build-release").sourceFiles;
}

function currentBuildMeta() {
  delete require.cache[buildReleasePath];
  const buildRelease = require("./build-release");
  return {
    appVersion: buildRelease.version,
    bootstrapVersion: buildRelease.devBootstrapVersion,
    sourceFiles: buildRelease.sourceFiles
  };
}

function currentSourceBundle() {
  return currentSourceFiles()
    .map((file) => {
      const fullPath = path.join(root, file);
      return `\n/* ${file} */\n${fs.readFileSync(fullPath, "utf8").trim()}\n`;
    })
    .join("\n");
}

function isAllowedPath(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  return allowedRoots.some((prefix) => normalized === prefix || normalized.startsWith(prefix + "/"));
}

function localPathForUrl(pathname) {
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (!relativePath || !isAllowedPath(relativePath)) return null;

  const fullPath = path.resolve(root, relativePath);
  const rootWithSeparator = root.endsWith(path.sep) ? root : root + path.sep;
  if (fullPath !== root && !fullPath.startsWith(rootWithSeparator)) return null;
  return fullPath;
}

function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

  if (url.pathname === "/" || url.pathname === "/health") {
    send(response, 200, "text/plain; charset=utf-8", "Accounting Helpers dev server is running.\n");
    return;
  }

  if (url.pathname === "/accounting-helpers.dev-status.json") {
    const meta = currentBuildMeta();
    send(response, 200, "application/json; charset=utf-8", `${JSON.stringify({
      ok: true,
      appVersion: meta.appVersion,
      bootstrapVersion: meta.bootstrapVersion,
      moduleCount: meta.sourceFiles.length,
      devUserscriptUrl: `http://${host}:${port}/userscript/accounting-helpers.dev.user.js`,
      runtimeUrl: `http://${host}:${port}/accounting-helpers.dev-runtime.js`,
      bundleUrl: `http://${host}:${port}/accounting-helpers.dev-bundle.js`
    }, null, 2)}\n`);
    return;
  }

  if (url.pathname === "/accounting-helpers.modules.json") {
    send(response, 200, "application/json; charset=utf-8", `${JSON.stringify({ files: currentSourceFiles() }, null, 2)}\n`);
    return;
  }

  if (url.pathname === "/accounting-helpers.dev-bundle.js") {
    send(response, 200, "text/javascript; charset=utf-8", currentSourceBundle());
    return;
  }

  if (url.pathname === "/accounting-helpers.dev-runtime.js") {
    send(response, 200, "text/javascript; charset=utf-8", fs.readFileSync(path.join(root, "tools", "dev-runtime.js"), "utf8"));
    return;
  }

  const fullPath = localPathForUrl(url.pathname);
  if (!fullPath) {
    send(response, 403, "text/plain; charset=utf-8", "Forbidden\n");
    return;
  }

  fs.stat(fullPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(response, 404, "text/plain; charset=utf-8", "Not found\n");
      return;
    }

    const contentType = contentTypes.get(path.extname(fullPath).toLowerCase()) || "application/octet-stream";
    response.writeHead(200, headers(contentType));
    fs.createReadStream(fullPath).pipe(response);
  });
}

const server = http.createServer(handleRequest);

server.listen(port, host, () => {
  console.log(`Accounting Helpers dev server: http://${host}:${port}`);
  console.log(`Install dev userscript: http://${host}:${port}/userscript/accounting-helpers.dev.user.js`);
});
