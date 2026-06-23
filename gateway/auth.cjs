"use strict";
// POST /auth/register — create a new brand + owner account
// POST /auth/token   — exchange email + password for a short-lived JWT
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");
const db = require("../core/db.cjs");
const config = require("../core/config.cjs");
const log = require("../core/logger.cjs").make("auth");

const router = express.Router();

// Rate limits
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", detail: "Try again in 15 minutes." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", detail: "Too many registrations from this IP." },
});

// Reserved brand IDs that cannot be self-registered
const RESERVED = new Set(["fixmyleads", "admin", "system", "root", "api", "www", "mail"]);

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// POST /auth/register
// Body: { email, password, name, company_name }
// Returns: { brand_id, email, message }
router.post("/register", registerLimiter, async (req, res) => {
  const { email, password, name, company_name } = req.body || {};
  if (!email || !password || !company_name) {
    return res.status(400).json({ error: "bad_request", detail: "email, password and company_name required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "bad_request", detail: "password must be at least 8 characters" });
  }

  const slug = slugify(company_name);
  if (!slug) {
    return res.status(400).json({ error: "bad_request", detail: "invalid company_name" });
  }
  if (RESERVED.has(slug)) {
    return res.status(400).json({ error: "bad_request", detail: "That brand name is reserved" });
  }

  // Check email not already used in this brand (shouldn't matter since brand is new, but guard it)
  const passwordHash = await bcrypt.hash(password, 10);
  let createdBrandId = null;

  try {
    await db.tx(async (tx) => {
      // Find a unique brand_id INSIDE transaction to prevent race condition
      let finalBrandId = slug;
      let suffix = 2;
      while (true) {
        const existing = await tx.query(`select id from ait_brands where brand_id=$1 for update`, [finalBrandId]);
        if (existing.rows.length === 0) break;
        finalBrandId = `${slug}-${suffix++}`;
        if (suffix > 99) throw new Error("Could not generate unique brand_id");
      }

      await tx.query(
        `insert into ait_brands (brand_id, name, owner_email) values ($1, $2, $3)`,
        [finalBrandId, company_name, email]
      );
      await tx.query(
        `insert into ait_users (brand_id, email, name, role, api_key_hash) values ($1, $2, $3, 'owner', $4)`,
        [finalBrandId, email, name || email.split("@")[0], passwordHash]
      );
      // Seed a default outbound sequence so autopilot can start working immediately
      const seqRow = await tx.query(
        `insert into ait_sequences (brand_id, name, channel) values ($1, 'Default Outbound', 'email') returning id`,
        [finalBrandId]
      );
      const seqId = seqRow.rows[0].id;
      const steps = [
        [1, 0,   "whatsapp", "Instant first-touch: brief intro, who we are, soft CTA. Include booking link if available."],
        [2, 24,  "email",    "Day 1 email: personalized first-touch referencing their business and industry challenges."],
        [3, 72,  "email",    "Day 3 email: value bump — a quick relevant idea/insight for their industry, soft CTA to a 15-min call."],
        [4, 168, "email",    "Day 7 email: case-study angle — similar client result in their industry, ask for 15-min slot."],
        [5, 336, "email",    "Day 14 breakup email: last outreach, leave door open, wish them well."],
      ];
      for (const [no, delay, ch, tmpl] of steps) {
        await tx.query(
          `insert into ait_sequence_steps (sequence_id, step_no, delay_hours, channel, template) values ($1,$2,$3,$4,$5)`,
          [seqId, no, delay, ch, tmpl]
        );
      }
      createdBrandId = finalBrandId;
    });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "conflict", detail: "Email already registered for this brand" });
    }
    log.error("register failed", e.message);
    return res.status(500).json({ error: "internal", detail: "Registration failed" });
  }

  log.info(`new brand registered: brand_id=${createdBrandId} owner=${email}`);
  return res.status(201).json({
    brand_id: createdBrandId,
    email,
    message: `Account created. Login: POST /auth/token with { email, api_key: "<your password>", brand_id: "${createdBrandId}" }`,
  });
});

// POST /auth/token  body: { email, api_key, brand_id? }
// Returns: { access_token, expires_in, role }
router.post("/token", loginLimiter, async (req, res) => {
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
  const ttlSec = JWT_TTL.endsWith("h") ? parseInt(JWT_TTL) * 3600
    : JWT_TTL.endsWith("m") ? parseInt(JWT_TTL) * 60
    : parseInt(JWT_TTL) || 28800;

  return res.json({ access_token, expires_in: ttlSec, role: user.role, brand_id: brandId });
});

module.exports = router;
