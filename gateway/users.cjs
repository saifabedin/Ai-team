"use strict";
// Team member management within a brand.
// Only the brand owner can invite or remove users.
// GET  /api/users          — list all users in my brand
// POST /api/users/invite   — add a team member (owner only)
// DELETE /api/users/:id    — remove a team member (owner only, can't remove self)
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../core/db.cjs");
const rbac = require("../core/rbac.cjs");
const log = require("../core/logger.cjs").make("users");

const router = express.Router();

const VALID_ROLES = new Set(["admin", "sales", "marketing", "cs", "viewer"]);

// GET /api/users
router.get("/", rbac.require("dashboard:read"), async (req, res, next) => {
  try {
    const rows = await db.many(
      `select id, email, name, role, created_at from ait_users
       where brand_id=$1 order by id asc`,
      [req.brandId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/users/invite
// Body: { email, password, name, role }
// role must be one of: admin|sales|marketing|cs|viewer (not owner)
router.post("/invite", async (req, res, next) => {
  // Only owners can invite
  if (req.user?.role !== "owner") {
    return res.status(403).json({ error: "forbidden", detail: "Only owners can invite team members" });
  }
  try {
    const { email, password, name, role } = req.body || {};
    if (!email || !password || !role) {
      return res.status(400).json({ error: "bad_request", detail: "email, password and role required" });
    }
    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({ error: "bad_request", detail: `role must be one of: ${[...VALID_ROLES].join(", ")}` });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "bad_request", detail: "password must be at least 8 characters" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await db.one(
      `insert into ait_users (brand_id, email, name, role, api_key_hash)
       values ($1, $2, $3, $4, $5)
       returning id, email, name, role, created_at`,
      [req.brandId, email, name || email.split("@")[0], role, hash]
    );
    log.info(`user invited: brand=${req.brandId} email=${email} role=${role}`);
    res.status(201).json(user);
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "conflict", detail: "Email already exists in this brand" });
    }
    next(e);
  }
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res, next) => {
  if (req.user?.role !== "owner") {
    return res.status(403).json({ error: "forbidden", detail: "Only owners can remove team members" });
  }
  try {
    const targetId = +req.params.id;
    // Prevent owner from removing themselves
    if (req.user?.id && req.user.id === targetId) {
      return res.status(400).json({ error: "bad_request", detail: "Cannot remove yourself" });
    }
    const target = await db.one(
      `select id, role from ait_users where brand_id=$1 and id=$2`,
      [req.brandId, targetId]
    );
    if (!target) return res.status(404).json({ error: "not_found" });
    if (target.role === "owner") {
      return res.status(400).json({ error: "bad_request", detail: "Cannot remove another owner" });
    }
    await db.query(`delete from ait_users where brand_id=$1 and id=$2`, [req.brandId, targetId]);
    res.json({ ok: true, removed: targetId });
  } catch (e) { next(e); }
});

module.exports = router;
