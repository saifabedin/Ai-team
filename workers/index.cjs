"use strict";
// BullMQ workers — the task-queue backbone. Each queue maps to a handler.
// Run as its own PM2 process (ai-team-worker).
const { Worker } = require("bullmq");
const { makeConnection } = require("../core/redis.cjs");
const log = require("../core/logger.cjs").make("worker");

const leadIntel = require("../departments/lead-intel/service.cjs");
const sdr      = require("../departments/sdr/service.cjs");
const voice    = require("../departments/voice/service.cjs");
const proposal = require("../departments/proposal/service.cjs");
const content  = require("../departments/content/service.cjs");
const success  = require("../departments/client-success/service.cjs");
const coordinator = require("../departments/patient-coordinator/service.cjs");
const aftercare = require("../departments/aftercare/service.cjs");
const reputation = require("../departments/reputation/service.cjs");
const referral = require("../departments/referral/service.cjs");
const campaign = require("../departments/campaign/service.cjs");
const social = require("../departments/social/service.cjs");
const adOps = require("../departments/ad-ops/service.cjs");
const reporting = require("../departments/reporting/service.cjs");
const deliverables = require("../departments/deliverables/service.cjs");
const prep = require("../departments/prep/service.cjs");

const handlers = {
  scrape:     async (job) => { log.info(`scrape job received: ${JSON.stringify(job.data)}`); return { ok: true, message: "scrape handler placeholder" }; },
  enrich:   async (job) => leadIntel.enrich(job.data.brandId, job.data.leadId),
  score:    async (job) => leadIntel.score(job.data.brandId, job.data.leadId),
  outreach: async (job) => sdr.runStep(job.data.brandId, job.data.enrollmentId),
  voice:    async (job) => voice.callLead(job.data.brandId, job.data.leadId, job.data.purpose),
  proposal: async (job) => proposal.create(job.data.brandId, job.data),
  content:  async (job) => content.create(job.data.brandId, job.data),
  success:  async (job) => success.onboard(job.data.brandId, job.data),
  // FML Health
  appointment: async (job) => coordinator.bookAppointment(job.data.brandId, job.data.patientId, job.data.doctorId, job.data.slotDatetime, job.data.type),
  prep:        async (job) => prep.generatePrep(job.data.brandId, job.data.appointmentId),
  aftercare:   async (job) => aftercare.generate(job.data.brandId, job.data.appointmentId, job.data.doctorNotes),
  reputation:  async (job) => reputation.processReview(job.data.brandId, job.data),
  referral:    async (job) => referral.convertReferral(job.data.brandId, job.data.referralId, job.data.referredPatientId),
  // ECM Agency
  campaign:    async (job) => campaign.create(job.data.brandId, job.data),
  social:      async (job) => social.createPost(job.data.brandId, job.data),
  "ad-ops":    async (job) => adOps.createCampaign(job.data.brandId, job.data),
  reporting:   async (job) => reporting.generateReport(job.data.brandId, job.data),
  deliverables: async (job) => deliverables.createDeliverable(job.data.brandId, job.data),
};

const workers = [];
for (const [queue, handler] of Object.entries(handlers)) {
  const w = new Worker(
    queue,
    async (job) => {
      log.info(`▶ ${queue}#${job.id}`, job.data);
      const out = await handler(job);
      log.info(`✔ ${queue}#${job.id} done`);
      return out;
    },
    { connection: makeConnection(), concurrency: 3 }
  );
  w.on("failed", (job, err) => log.error(`✘ ${queue}#${job?.id} failed`, err.message));
  workers.push(w);
}

log.info(`workers online: ${Object.keys(handlers).join(", ")}`);

process.on("SIGTERM", async () => {
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});
