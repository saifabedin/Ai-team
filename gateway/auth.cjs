"use strict";
// POST /auth/token  — exchange email + api_key for a short-lived JWT.
// Rate limit: 10 requests per 15 min per IP (ecm-security spec).
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");
const db = require("../core/db.cjs");
const config = require("../core/config.cjs");

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", detail: "Try again in 15 minutes." },
});

// POST /auth/token  body: { email, api_key, brand_id? }
// Returns: { access_token, expires_in: 900 }
router.post("/token", limiter, async (req, res) => {
  const { email, api_key, brand_id } = req.body || {};
  if (!email || !api_key) {
    return res.status(400).json({ error: "bad_request", detail: "email and api_key required" });
  }
  const brandId = brand_id || config.defaultBrandId;

  let user;
  try {
    user = await db.one(
      `select id, email, name, role, api_key_hash from ait_users
       where brand_id=$1 and email=$2`,
      [brandId, email]
    );
  } catch {
    // Timing-safe: always run bcrypt even on miss to prevent user enumeration.
    await bcrypt.compare("noop", "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345");
    return res.status(401).json({ error: "unauthorized", detail: "Invalid credentials" });
  }

  if (!user?.api_key_hash) {
    await bcrypt.compare("noop", "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345");
    return res.status(401).json({ error: "unauthorized", detail: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(api_key, user.api_key_hash);
  if (!valid) {
    return res.status(401).json({ error: "unauthorized", detail: "Invalid credentials" });
  }

  const JWT_TTL = process.env.JWT_TTL || "8h";
  const payload = { email: user.email, role: user.role, brandId, sub: String(user.id) };
  const access_token = jwt.sign(payload, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: JWT_TTL,
  });
  // expires_in in seconds: parse common suffixes
  const ttlSec = JWT_TTL.endsWith("h") ? parseInt(JWT_TTL) * 3600
    : JWT_TTL.endsWith("m") ? parseInt(JWT_TTL) * 60
    : parseInt(JWT_TTL) || 28800;

  return res.json({ access_token, expires_in: ttlSec, role: user.role });
});

module.exports = router;
