"use strict";
// Standalone CEO dashboard server (serves HTML + proxies to gateway API).
// For simplicity it mounts the same routes + serves the static page.
const express = require("express");
const path = require("path");
const config = require("../core/config.cjs");
const log = require("../core/logger.cjs").make("dashboard");
const { attachUser, auditWrites } = require("../gateway/middleware.cjs");

const app = express();
app.use(express.json());
app.use(attachUser);
app.use(auditWrites);
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/dashboard", require("./routes.cjs"));
// also expose lead-intel here so the dashboard's own controls (source / sheet
// pull / ingest) work same-origin on :4101 without cross-port CORS.
app.use("/api/lead-intel", require("../departments/lead-intel/routes.cjs"));
app.get("/health", (_q, r) => r.json({ ok: true, service: "ai-team-dashboard" }));

// 404 handler for unmatched routes
app.use((req, res) => res.status(404).json({ error: "not_found", path: req.path }));

// Error handler
app.use((err, _req, res, _next) => {
  log.error("unhandled", err.message);
  res.status(500).json({ error: "internal", message: "An internal error occurred" });
});

if (require.main === module) {
  app.listen(config.dashboardPort, () => log.info(`dashboard up on :${config.dashboardPort}`));
}
module.exports = app;
