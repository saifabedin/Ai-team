"use strict";
// BullMQ queues for the AI Team. One queue per pipeline stage.
const { Queue } = require("bullmq");
const { makeConnection } = require("./redis.cjs");

const QUEUE_NAMES = [
  "scrape", // reserved for future use — no worker handler yet; do not remove (referenced by QUEUE_NAMES consumers)
  "enrich", // lead enrichment
  "score", // lead scoring
  "outreach", // SDR email/whatsapp/linkedin
  "voice", // outbound calls
  "proposal", // proposal/quote/contract generation
  "content", // content marketing
  "success", // client success / onboarding / upsell
  // FML Health queues
  "appointment", // booking, reminders, reschedule
  "prep", // pre-appointment workflows
  "aftercare", // post-visit care automation
  "reputation", // review requests, responses
  "referral", // referral tracking, incentives
  // ECM Agency queues
  "campaign", // campaign lifecycle
  "social", // social media publishing
  "ad-ops", // ad campaign management
  "reporting", // report generation
  "deliverables", // deliverable tracking
];

const queues = {};
for (const name of QUEUE_NAMES) {
  queues[name] = new Queue(name, {
    connection: makeConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 1000,
    },
  });
}

/** enqueue a job onto a named queue. */
async function enqueue(queueName, jobName, data, opts = {}) {
  const q = queues[queueName];
  if (!q) throw new Error(`Unknown queue: ${queueName}`);
  return q.add(jobName, data, opts);
}

module.exports = { queues, enqueue, QUEUE_NAMES };
