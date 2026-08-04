import { timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function bearer(req) {
  const header = req.headers.authorization || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return "";
}

function unauthorized() {
  return Object.assign(new Error("Unauthorized."), {
    statusCode: 401,
    code: "unauthorized",
  });
}

/**
 * Every admin endpoint (create/send/status/test) requires this.
 * Send it as: Authorization: Bearer <ADMIN_API_TOKEN>
 */
export function requireAdmin(req) {
  if (!config.adminToken) {
    throw Object.assign(
      new Error("ADMIN_API_TOKEN is not configured on the server."),
      { statusCode: 500, code: "missing_env" },
    );
  }
  const token = bearer(req) || String(req.headers["x-admin-token"] || "");
  if (!token || !safeEqual(token, config.adminToken)) throw unauthorized();
}

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
 * set. The admin token is also accepted so the job can be triggered by hand.
 */
export function requireCronOrAdmin(req) {
  const token = bearer(req) || String(req.headers["x-admin-token"] || "");
  if (config.cronSecret && token && safeEqual(token, config.cronSecret)) return;
  requireAdmin(req);
}
