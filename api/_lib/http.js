// Small helpers so each route stays focused on its own logic.

export function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  sendJson(res, 405, { error: `Method not allowed. Use ${allowed.join(" or ")}.` });
}

/**
 * Vercel parses JSON bodies automatically, but a raw string arrives when the
 * client omits/mangles the content-type. Handle both.
 */
export function readJsonBody(req) {
  const body = req.body;
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      throw Object.assign(new Error("Request body is not valid JSON."), {
        statusCode: 400,
        code: "invalid_json",
      });
    }
  }
  return body;
}

/**
 * Wraps a handler so thrown errors become clean JSON responses.
 * Attach `statusCode` to an error to control the response status.
 */
export function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      const statusCode = error?.statusCode || 500;
      if (statusCode >= 500) {
        console.error("[mailer] unhandled error:", error);
      }
      if (res.headersSent) return undefined;
      return sendJson(res, statusCode, {
        error: error?.message || "Unexpected server error.",
        code: error?.code,
      });
    }
  };
}

export function badRequest(message, code = "bad_request") {
  return Object.assign(new Error(message), { statusCode: 400, code });
}

export function notFound(message, code = "not_found") {
  return Object.assign(new Error(message), { statusCode: 404, code });
}
