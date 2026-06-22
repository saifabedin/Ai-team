"use strict";
// SDR orchestration: enroll leads in sequences, run steps, handle replies, book meetings.
const db = require("../../core/db.cjs");
const crm = require("../../core/crm.cjs");
const bus = require("../../core/bus.cjs");
const config = require("../../core/config.cjs");
const { SDRAgent } = require("./agent.cjs");
const channels = require("./channels.cjs");

const agent = new SDRAgent();

async function company(lead) {
  return lead.company_id ? db.one(`select * from ait_companies where id=$1`, [lead.company_id]) : null;
}

// Enroll a lead into a sequence.
async function enroll(brandId, leadId, sequenceId) {
  const seq = sequenceId
    ? await db.one(`select * from ait_sequences where brand_id=$1 and id=$2`, [brandId, sequenceId])
    : await db.one(`select * from ait_sequences where brand_id=$1 and active=true order by id limit 1`, [brandId]);
  if (!seq) throw new Error("no sequence available");
  const row = await db.one(
    `insert into ait_enrollments (brand_id, lead_id, sequence_id, current_step, status, next_run_at)
     values ($1,$2,$3,0,'active',now())
     on conflict (lead_id, sequence_id) do update set status='active', next_run_at=now()
     returning *`,
    [brandId, leadId, seq.id]
  );
  return row;
}

// Advance one step of an enrollment: draft + send via channel.
async function runStep(brandId, enrollmentId) {
  return agent.run(brandId, "send-step", async () => {
    const enr = await db.one(`select * from ait_enrollments where brand_id=$1 and id=$2`, [brandId, enrollmentId]);
    if (!enr || enr.status !== "active") return { skipped: true };
    const nextNo = enr.current_step + 1;
    const step = await db.one(
      `select * from ait_sequence_steps where sequence_id=$1 and step_no=$2`,
      [enr.sequence_id, nextNo]
    );
    if (!step) {
      await db.query(`update ait_enrollments set status='done' where brand_id=$1 and id=$2`, [brandId, enrollmentId]);
      return { done: true };
    }
    const lead = await crm.getLead(brandId, enr.lead_id);
    const co = await company(lead);
    const msg = await agent.draft(lead, co, step, step.channel);
    // Append booking link to WA/LinkedIn first-touch if configured.
    const bookingLink = config.bookingLink;
    const bodyWithLink =
      bookingLink && step.step_no === 1 && step.channel !== "email"
        ? `${msg.body}\n\nBook a quick call: ${bookingLink}`
        : msg.body;
    const to = step.channel === "email" ? lead.email : lead.phone || lead.email;
    await channels[step.channel](brandId, lead.id, { to, subject: msg.subject, body: bodyWithLink });
    await crm.logActivity(brandId, lead.id, { type: step.channel, channel: step.channel, subject: msg.subject, body: msg.body });
    await crm.setStatus(brandId, lead.id, "contacted");
    await db.query(
      `update ait_enrollments set current_step=$2, next_run_at=now() + ($3 || ' hours')::interval where id=$1`,
      [enrollmentId, nextNo, String(step.delay_hours)]
    );
    return { step: nextNo, channel: step.channel, to, subject: msg.subject };
  });
}

// Handle an inbound reply from a lead.
async function handleReply(brandId, leadId, text) {
  return agent.run(brandId, "handle-reply", async () => {
    const lead = await crm.getLead(brandId, leadId);
    const verdict = await agent.handleObjection(lead, text);
    await crm.logActivity(brandId, leadId, { type: "email", direction: "in", body: text });
    if (verdict.intent === "unsubscribe") {
      await db.query(`update ait_enrollments set status='paused' where brand_id=$1 and lead_id=$2`, [brandId, leadId]);
      await crm.setStatus(brandId, leadId, "lost");
    } else {
      await crm.setStatus(brandId, leadId, "engaged");
      if (verdict.book_meeting) await bookMeeting(brandId, leadId, "Auto-booked from positive reply");
    }
    return verdict;
  });
}

// Book a meeting — use Cal.com link from config, else fall back to mock.
async function bookMeeting(brandId, leadId, notes, when) {
  const scheduledAt = when
    ? new Date(when).toISOString()
    : new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
  const link = config.bookingLink || `https://meet.google.com/mock-${leadId}`;
  const m = await db.one(
    `insert into ait_meetings (brand_id, lead_id, scheduled_at, status, channel, link, notes)
     values ($1,$2,$3,'booked','gmeet',$4,$5) returning *`,
    [brandId, leadId, scheduledAt, link, notes || ""]
  );
  // Cancel active enrollments so the lead isn't outreached after booking.
  await db.query(
    `update ait_enrollments set status='paused' where brand_id=$1 and lead_id=$2 and status='active'`,
    [brandId, leadId]
  );
  await crm.setStatus(brandId, leadId, "meeting");
  await bus.publish({ brandId, from: "nova", to: "broadcast", topic: "meeting.booked", payload: { leadId, meetingId: m.id } });
  return m;
}

module.exports = { enroll, runStep, handleReply, bookMeeting };
