import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const sensitiveKey = /password|secret|token|authorization|cookie|api.?key|email|phone|address|name|session|card|notes/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (Buffer.isBuffer(value)) return "[raw body omitted]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, item]) => [
      key, sensitiveKey.test(key) ? "[REDACTED]" : sanitize(item, depth + 1),
    ]));
  }
  if (typeof value === "string") {
    return value.slice(0, 500)
      .replace(/https?:\/\/\S+/g, "[URL omitted]")
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email redacted]")
      .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[REDACTED]");
  }
  return value;
}

export const requestLogger: RequestHandler = (req, res, next) => {
  if (process.env.HTTP_LOGGING !== "true") return next();
  const id = randomUUID();
  const started = Date.now();
  let responseBody: unknown = "[non-JSON body omitted]";
  const originalJson = res.json;
  res.json = function (body) {
    responseBody = sanitize(body);
    return originalJson.call(this, body);
  };
  console.log("[HTTP incoming]", JSON.stringify({ id, method: req.method, path: sanitize(req.path) }));
  res.once("finish", () => {
    console.log("[HTTP request]", JSON.stringify({ id, method: req.method, path: sanitize(req.path), query: sanitize(req.query), body: sanitize(req.body) }));
    console.log("[HTTP response]", JSON.stringify({ id, status: res.statusCode, durationMs: Date.now() - started, body: responseBody }));
  });
  next();
};
