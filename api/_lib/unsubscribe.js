import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

// Stateless, signed unsubscribe links: the email address travels in the URL
// and an HMAC proves we generated it, so nobody can unsubscribe someone else.

function b64url(input) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(payload) {
  return createHmac("sha256", config.unsubscribeSecret)
    .update(payload)
    .digest("base64url");
}

export function createUnsubscribeToken(email) {
  const normalized = normalizeEmail(email);
  const payload = b64url(normalized);
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(token) {
  if (!token || typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function unsubscribeUrl(email) {
  const token = createUnsubscribeToken(email);
  return `${config.siteUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Deliberately permissive: just enough to catch typos and empty values.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  return normalized.length <= 254 && EMAIL_RE.test(normalized);
}
