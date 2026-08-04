#!/usr/bin/env node
// Local server for /api/* routes — no Vercel login/link required.
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 3001);

const routes = {
  "POST /api/campaigns/create": "api/campaigns/create.js",
  "POST /api/campaigns/send": "api/campaigns/send.js",
  "GET /api/campaigns/status": "api/campaigns/status.js",
  "POST /api/campaigns/status": "api/campaigns/status.js",
  "POST /api/campaigns/preview": "api/campaigns/preview.js",
  "GET /api/unsubscribe": "api/unsubscribe.js",
  "POST /api/unsubscribe": "api/unsubscribe.js",
  "GET /api/cron/resume-campaigns": "api/cron/resume-campaigns.js",
  "POST /api/cron/resume-campaigns": "api/cron/resume-campaigns.js",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function makeRes(nodeRes) {
  let statusCode = 200;
  const headers = {};
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers[name] = value;
      return this;
    },
    json(payload) {
      const body = JSON.stringify(payload);
      headers["Content-Type"] = headers["Content-Type"] || "application/json; charset=utf-8";
      nodeRes.writeHead(statusCode, headers);
      nodeRes.end(body);
    },
    send(payload) {
      if (typeof payload === "object" && payload !== null && !Buffer.isBuffer(payload)) {
        return this.json(payload);
      }
      if (!headers["Content-Type"]) {
        headers["Content-Type"] =
          typeof payload === "string" && payload.trimStart().startsWith("<")
            ? "text/html; charset=utf-8"
            : "text/plain; charset=utf-8";
      }
      nodeRes.writeHead(statusCode, headers);
      nodeRes.end(payload);
    },
    get headersSent() {
      return nodeRes.headersSent;
    },
  };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    const key = `${req.method} ${url.pathname.replace(/\/+$/, "") || "/"}`;
    const file = routes[key];

    if (!file) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `No route for ${req.method} ${url.pathname}` }));
      return;
    }

    const raw = await readBody(req);
    let body = {};
    if (raw) {
      const type = String(req.headers["content-type"] || "");
      if (type.includes("application/json")) {
        try {
          body = JSON.parse(raw);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON body." }));
          return;
        }
      } else if (type.includes("application/x-www-form-urlencoded")) {
        body = Object.fromEntries(new URLSearchParams(raw));
      } else {
        body = raw;
      }
    }

    const query = Object.fromEntries(url.searchParams.entries());
    const handlerMod = await import(
      pathToFileURL(path.join(root, file)).href + `?t=${Date.now()}`
    );
    const handler = handlerMod.default;
    const vercelReq = {
      method: req.method,
      headers: req.headers,
      query,
      body,
      url: req.url,
    };
    await handler(vercelReq, makeRes(res));
  } catch (error) {
    console.error("[local-api]", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message || "Server error" }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`\nLocal mail API ready at http://localhost:${PORT}`);
  console.log(`Point the CLI at it with:`);
  console.log(`  $env:MAILER_BASE_URL="http://localhost:${PORT}"`);
  console.log(`  npm run mail -- audience --attending yes\n`);
});
