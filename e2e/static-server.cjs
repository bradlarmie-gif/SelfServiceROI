// Minimal static file server for the built client (dist/public), with SPA
// fallback to index.html. Used only by the Playwright responsive e2e test so we
// don't need the full app server (which requires DATABASE_URL to boot).
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.argv[2] || process.env.PORT || "5055", 10);
const ROOT = path.resolve(__dirname, "..", "dist", "public");

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".json": "application/json", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = path.join(ROOT, urlPath);
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.stat(filePath, (err, stat) => {
      if (err || stat.isDirectory()) filePath = path.join(ROOT, "index.html"); // SPA fallback
      fs.readFile(filePath, (e, data) => {
        if (e) { res.writeHead(404); return res.end("not found"); }
        res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
        res.end(data);
      });
    });
  })
  .listen(PORT, () => console.log(`static client on http://localhost:${PORT}`));
