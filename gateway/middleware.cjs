"use strict";
// Auth + brand + audit middleware for the gateway.
// Auth: Bearer JWT (HS256). Dev-only fallback disabled in live mode.
const jwt = require("jsonwebtoken");
const db = require("../core/db.cjs");
const audit = require("../core/audit.cjs");
const config = require("../core/config.cjs");
const log = require("../core/logger.cjs").make("middleware");

const DEV_USER = { id: null, email: "owner@local", role: "owner" };

// Verify Bearer JWT and attach user + brandId to req.
async function attachUser(req, res, next) {
  const brandId = req.header("x-brand-id") || config.defaultBrandId;
  req.brandId = brandId;

  const authHeader = req.header("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // In live mode OR production env a token is mandatory — no fallback.
  if (!token) {
    if (config.isLive || process.env.NODE_ENV === "production") {
      return res.status(401).json({ error: "unauthorized", detail: "Bearer token required" });
    }
    // Dev convenience: unauthenticated requests get owner rights locally.
    log.warn("dev auth bypass active — set PROVIDER_MODE=live or NODE_ENV=production to require tokens");
    req.user = DEV_USER;
    return next();
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
  } catch (e) {
    return res.status(401).json({ error: "unauthorized", detail: e.message });
  }

  try {
    const user = await db.one(
      `select id, email, name, role from ait_users where brand_id=$1 and email=$2`,
      [payload.brandId || brandId, payload.email]
    );
    req.user = user || { id: null, email: payload.email, role: "viewer" };
    req.brandId = payload.brandId || brandId;
  } catch {
    req.user = { id: null, email: payload.email, role: payload.role || "viewer" };
  }

  next();
}

// Audit every state-changing request.
function auditWrites(req, res, next) {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    res.on("finish", () => {
      if (res.statusCode < 400) {
        audit.record({
          brandId: req.brandId,
          actor: req.user?.email || "system",
          action: `http:${req.method} ${req.path}`,
          entity: "request",
          meta: { status: res.statusCode },
        });
      }
    });
  }
  next();
}

module.exports = { attachUser, auditWrites };
