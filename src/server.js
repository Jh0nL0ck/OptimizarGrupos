import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XProtectClient } from "./xprotectClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");
const port = Number(process.env.PORT || 3000);
const allowSelfSignedDefault = process.env.XPROTECT_ALLOW_SELF_SIGNED === "true";
const sessions = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function send(res, statusCode, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Length": Buffer.byteLength(payload),
    ...headers
  });
  res.end(payload);
}

function sendJson(res, statusCode, body, headers = {}) {
  send(res, statusCode, body, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) {
      throw new Error("Request body is too large.");
    }
  }
  return raw ? JSON.parse(raw) : {};
}

function getClient(req) {
  const sessionId = parseCookies(req.headers.cookie).xco_session;
  const session = sessionId ? sessions.get(sessionId) : null;
  if (!session) {
    return null;
  }
  return new XProtectClient(session);
}

function cleanName(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w .()\-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

async function handleApi(req, res) {
  try {
    if (req.method === "POST" && req.url === "/api/connect") {
      const body = await readJson(req);
      const allowSelfSigned = body.allowSelfSigned ?? allowSelfSignedDefault;
      const client = await XProtectClient.login({
        serverUrl: body.serverUrl,
        username: body.username,
        password: body.password,
        allowSelfSigned
      });

      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, {
        serverUrl: client.baseUrl,
        token: client.token,
        allowSelfSigned
      });

      const inventory = await client.getInventory();
      sendJson(res, 200, inventory, {
        "Set-Cookie": `xco_session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/`
      });
      return;
    }

    if (req.method === "GET" && req.url === "/api/inventory") {
      const client = getClient(req);
      if (!client) {
        sendJson(res, 401, { error: "Not connected." });
        return;
      }
      sendJson(res, 200, await client.getInventory());
      return;
    }

    if (req.method === "POST" && req.url === "/api/groups") {
      const client = getClient(req);
      if (!client) {
        sendJson(res, 401, { error: "Not connected." });
        return;
      }

      const body = await readJson(req);
      const model = cleanName(body.model);
      const cameraIds = Array.isArray(body.cameraIds) ? body.cameraIds.filter(Boolean) : [];
      const name = cleanName(body.name || `Model - ${model}`);

      if (!model || !name || cameraIds.length === 0) {
        sendJson(res, 400, { error: "Model, group name and at least one camera are required." });
        return;
      }

      const result = await client.createGroupWithCameras({ name, model, cameraIds });
      sendJson(res, 201, result);
      return;
    }

    if (req.method === "POST" && req.url === "/api/logout") {
      const sessionId = parseCookies(req.headers.cookie).xco_session;
      if (sessionId) {
        sessions.delete(sessionId);
      }
      sendJson(res, 200, { ok: true }, {
        "Set-Cookie": "xco_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
      });
      return;
    }

    sendJson(res, 404, { error: "API route not found." });
  } catch (error) {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    sendJson(res, statusCode, { error: error.message || "Unexpected server error." });
  }
}

async function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const safePath = path.normalize(requestPath === "/" ? "/index.html" : requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    send(res, 200, file, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream"
    });
  } catch {
    send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  }
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    void handleApi(req, res);
    return;
  }
  void serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`XProtect Camera Group Optimizer running at http://localhost:${port}`);
});
