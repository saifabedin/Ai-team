"use strict";
// FixMyLeads AI Team — API Gateway. Mounts every department's routes,
// applies auth + RBAC + audit, exposes health.
const express = require("express");
const cors = require("cors");
const config = require("../core/config.cjs");
const log = require("../core/logger.cjs").make("gateway");
const { attachUser, auditWrites } = require("./middleware.cjs");

const app = express();
app.use(cors({
  origin: config.corsOrigins || "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Brand-ID"],
}));
app.use(express.json({ limit: "2mb" }));
app.use(attachUser);
app.use(auditWrites);

// public auth routes (no JWT required, rate-limited inside)
app.use("/auth", require("./auth.cjs"));

// webhooks (no JWT required, external services post here)
app.use("/webhook/whatsapp", require("./webhook-whatsapp.cjs"));

// health
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "ai-team-gateway", mode: config.providerMode, ts: Date.now() })
);

// whoami (handy for debugging RBAC)
app.get("/me", (req, res) => res.json({ brandId: req.brandId, user: req.user }));

// team management
app.use("/api/users", require("./users.cjs"));

// department routes
app.use("/api/lead-intel", require("../departments/lead-intel/routes.cjs"));
app.use("/api/sdr", require("../departments/sdr/routes.cjs"));
app.use("/api/voice", require("../departments/voice/routes.cjs"));
app.use("/api/proposal", require("../departments/proposal/routes.cjs"));
app.use("/api/content", require("../departments/content/routes.cjs"));
app.use("/api/success", require("../departments/client-success/routes.cjs"));
app.use("/api/dashboard", require("../dashboard/routes.cjs"));
// FML Health
app.use("/api/coordinator", require("../departments/patient-coordinator/routes.cjs"));
app.use("/api/appointment", require("../departments/appointment/routes.cjs"));
app.use("/api/prep", require("../departments/prep/routes.cjs"));
app.use("/api/aftercare", require("../departments/aftercare/routes.cjs"));
app.use("/api/reputation", require("../departments/reputation/routes.cjs"));
app.use("/api/referral", require("../departments/referral/routes.cjs"));

// ECM Agency Features
app.use("/api/campaign", require("../departments/campaign/routes.cjs"));
app.use("/api/social", require("../departments/social/routes.cjs"));
app.use("/api/ad-ops", require("../departments/ad-ops/routes.cjs"));
app.use("/api/reporting", require("../departments/reporting/routes.cjs"));
app.use("/api/white-label", require("../departments/white-label/routes.cjs"));
app.use("/api/calendar", require("../departments/calendar/routes.cjs"));
app.use("/api/deliverables", require("../departments/deliverables/routes.cjs"));
app.use("/api/client-health", require("../departments/client-health/routes.cjs"));

// 404 + error
app.use((req, res) => res.status(404).json({ error: "not_found", path: req.path }));
app.use((err, _req, res, _next) => {
  log.error("unhandled", err.message);
  res.status(500).json({ error: "internal", message: "An internal error occurred" });
});

if (require.main === module) {
  app.listen(config.port, () => log.info(`gateway up on :${config.port} (mode=${config.providerMode})`));
}

module.exports = app;
