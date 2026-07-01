"use strict";
// Facebook OAuth routes — mount on Express gateway
const express = require("express");
const router = express.Router();
const oauth = require("./auth-facebook.cjs");
const log = require("../core/logger.cjs").make("fb-routes");

// GET /auth/facebook/connect → Returns OAuth URL for user to click
router.get("/connect", (req, res) => {
  const brandId = req.query.brand || req.headers["x-brand-id"] || "fixmyleads";
  const userId = req.query.user || req.user?.id || null;
  const result = oauth.getOAuthUrl(brandId, userId);
  if (result.error) return res.status(500).json({ error: result.error });
  res.json(result);
});

// GET /auth/facebook/callback → Facebook redirects here after user approves
router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`/#/settings?fb_error=${error}`);
  if (!code) return res.redirect("/#/settings?fb_error=no_code");

  try {
    const result = await oauth.handleCallback(code, state);
    // Redirect to dashboard with success
    const params = new URLSearchParams({
      fb_connected: "1",
      pages: result.pages.length,
      instagram: result.instagram.length,
      ads: result.ads.length,
    });
    res.redirect(`/#/settings?${params}`);
  } catch (e) {
    log.error("oauth callback failed", e.message);
    res.redirect(`/#/settings?fb_error=${encodeURIComponent(e.message)}`);
  }
});

// GET /auth/facebook/pages → List connected pages for a brand
router.get("/pages", async (req, res) => {
  try {
    const brandId = req.query.brand || req.headers["x-brand-id"] || "fixmyleads";
    const connections = await oauth.getConnections(brandId);
    const pages = connections.filter(c => c.platform === "facebook");
    res.json({ pages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /auth/facebook/instagram → List connected Instagram accounts
router.get("/instagram", async (req, res) => {
  try {
    const brandId = req.query.brand || req.headers["x-brand-id"] || "fixmyleads";
    const connections = await oauth.getConnections(brandId);
    const ig = connections.filter(c => c.platform === "instagram");
    res.json({ instagram: ig });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /auth/facebook/ads → List connected Ad accounts
router.get("/ads", async (req, res) => {
  try {
    const brandId = req.query.brand || req.headers["x-brand-id"] || "fixmyleads";
    const connections = await oauth.getConnections(brandId);
    const ads = connections.filter(c => c.platform === "facebook-ads");
    res.json({ ads });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /auth/facebook/disconnect/:id → Disconnect a social account
router.delete("/disconnect/:id", async (req, res) => {
  try {
    const brandId = req.query.brand || req.headers["x-brand-id"] || "fixmyleads";
    await oauth.disconnect(brandId, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /auth/facebook/status → Connection status summary
router.get("/status", async (req, res) => {
  try {
    const brandId = req.query.brand || req.headers["x-brand-id"] || "fixmyleads";
    const connections = await oauth.getConnections(brandId);
    res.json({
      connected: connections.length > 0,
      facebook: connections.filter(c => c.platform === "facebook").map(c => ({ name: c.name, id: c.accountId, status: c.status })),
      instagram: connections.filter(c => c.platform === "instagram").map(c => ({ username: c.name, id: c.accountId, status: c.status })),
      ads: connections.filter(c => c.platform === "facebook-ads").map(c => ({ name: c.name, id: c.accountId, status: c.status })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
