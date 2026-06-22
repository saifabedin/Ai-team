"use strict";
// FixMyLeads AI Team — API Gateway. Mounts every department's routes,
// applies auth + RBAC + audit, exposes health.
const express = require("express");
const config = require("../core/config.cjs");
const log = require("../core/logger.cjs").make("gateway");
const { attachUser, auditWrites } = require("./middleware.cjs");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(attachUser);
app.use(auditWrites);

// public auth routes (no JWT required, rate-limited inside)
app.use("/auth", require("./auth.cjs"));

// health
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "ai-team-gateway", mode: config.providerMode, ts: Date.now() })
);

// whoami (handy for debugging RBAC)
app.get("/me", (req, res) => res.json({ brandId: req.brandId, user: req.user }));

// department routes
app.use("/api/lead-intel", require("../departments/lead-intel/routes.cjs"));
app.use("/api/sdr", require("../departments/sdr/routes.cjs"));
app.use("/api/voice", require("../departments/voice/routes.cjs"));
app.use("/api/proposal", require("../departments/proposal/routes.cjs"));
app.use("/api/content", require("../departments/content/routes.cjs"));
app.use("/api/success", require("../departments/client-success/routes.cjs"));
app.use("/api/dashboard", require("../dashboard/routes.cjs"));

// 404 + error
app.use((req, res) => res.status(404).json({ error: "not_found", path: req.path }));
app.use((err, _req, res, _next) => {
  log.error("unhandled", err.message);
  res.status(500).json({ error: "internal", message: err.message });
});

if (require.main === module) {
  app.listen(config.port, () => log.info(`gateway up on :${config.port} (mode=${config.providerMode})`));
}

module.exports = app;
