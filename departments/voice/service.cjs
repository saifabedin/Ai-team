"use strict";
// Voice orchestration: script -> dial -> transcript -> outcome -> CRM update.
const db = require("../../core/db.cjs");
const crm = require("../../core/crm.cjs");
const bus = require("../../core/bus.cjs");
const { VoiceAgent } = require("./agent.cjs");
const { placeCall } = require("./adapter.cjs");

const agent = new VoiceAgent();

async function callLead(brandId, leadId, purpose = "discovery") {
  return agent.run(brandId, "outbound-call", async () => {
    const lead = await crm.getLead(brandId, leadId);
    if (!lead) throw new Error("lead not found");
    if (!lead.phone) throw new Error("lead has no phone");
    const co = lead.company_id ? await db.one(`select * from ait_companies where id=$1`, [lead.company_id]) : null;

    const call = await db.one(
      `insert into ait_calls (brand_id, lead_id, direction, status) values ($1,$2,'out','dialing') returning id`,
      [brandId, leadId]
    );

    const script = await agent.script(lead, co, purpose);
    const result = await placeCall({ to: lead.phone, script });
    const outcome = await agent.parseOutcome(result.transcript || "");

    await db.query(
      `update ait_calls set status=$2, outcome=$3, transcript=$4, recording_url=$5, duration_sec=$6, meta=$7 where id=$1`,
      [call.id, result.status, outcome.outcome, result.transcript, result.recording_url || null,
       result.duration_sec || null, { sentiment: outcome.sentiment, summary: outcome.summary }]
    );
    await crm.logActivity(brandId, leadId, { type: "call", body: outcome.summary, meta: outcome });

    if (outcome.outcome === "booked") {
      // Default +2 days; exact time confirmed with lead via follow-up
      const scheduledAt = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
      await db.query(
        `insert into ait_meetings (brand_id, lead_id, scheduled_at, status, channel, notes)
         values ($1,$2,$3,'booked','phone',$4)`,
        [brandId, leadId, scheduledAt, outcome.summary]
      );
      await crm.setStatus(brandId, leadId, "meeting");
    } else if (outcome.outcome === "not-interested") {
      await crm.setStatus(brandId, leadId, "lost");
    } else {
      await crm.setStatus(brandId, leadId, "engaged");
    }
    return { callId: call.id, ...outcome };
  });
}

// Confirm an upcoming meeting — updates status and notifies Nova to send confirmation to lead.
async function confirmMeeting(brandId, meetingId) {
  const m = await db.one(
    `select m.*, l.phone, l.email, l.full_name
     from ait_meetings m
     join ait_leads l on l.id = m.lead_id
     where m.brand_id=$1 and m.id=$2`,
    [brandId, meetingId]
  );
  if (!m) throw new Error("meeting not found");
  await db.query(`update ait_meetings set status='confirmed' where brand_id=$1 and id=$2`, [brandId, meetingId]);
  // Notify Nova to send WhatsApp/email confirmation to the lead
  await bus.publish({
    brandId, from: "vox", to: "nova",
    topic: "meeting.confirmed",
    payload: { meetingId, leadPhone: m.phone, leadEmail: m.email, scheduledAt: m.scheduled_at },
  });
  return { meetingId, status: "confirmed" };
}

module.exports = { callLead, confirmMeeting };
