"use strict";
// Reputation orchestration — review requests, sentiment, responses, trends.
const db = require("../../core/db.cjs");
const bus = require("../../core/bus.cjs");
const { ReputationAgent } = require("./agent.cjs");
const platforms = require("./platforms.cjs");
const config = require("../../core/config.cjs");

const agent = new ReputationAgent();

// Send review request after appointment completion.
async function requestReview(brandId, appointmentId, platform = "google") {
  return agent.run(brandId, "request-review", async () => {
    const appt = await db.one(
      `select a.*, p.full_name as patient_name, p.phone as patient_phone,
              p.language as patient_lang, d.full_name as doctor_name
       from fmlh_appointments a
       join fmlh_patients p on p.id = a.patient_id
       join fmlh_doctors d on d.id = a.doctor_id
       where a.brand_id=$1 and a.id=$2`,
      [brandId, appointmentId]
    );
    if (!appt) throw new Error("appointment not found");

    const patient = {
      id: appt.patient_id,
      full_name: appt.patient_name,
      phone: appt.patient_phone,
      language: appt.patient_lang,
    };

    // Check if review already requested
    const existing = await db.oneOrNone(
      `select id from fmlh_reviews where brand_id=$1 and appointment_id=$2`,
      [brandId, appointmentId]
    );
    if (existing) return { status: "already_requested" };

    // Send review request
    const result = await platforms.sendReviewRequest(brandId, patient, appt, platform);

    // Create review record
    const review = await db.one(
      `insert into fmlh_reviews (brand_id, patient_id, appointment_id, platform, status)
       values ($1,$2,$3,$4,'pending') returning *`,
      [brandId, appt.patient_id, appointmentId, platform]
    );

    // Log journey
    await db.one(
      `insert into fmlh_patient_journey (brand_id, patient_id, appointment_id, stage, action, channel, actor)
       values ($1,$2,$3,'review_sent','review_request_sent','whatsapp','sentinel') returning id`,
      [brandId, appt.patient_id, appointmentId]
    );

    return { reviewId: review.id, platform, link: result.link };
  });
}

// Process an incoming review (from webhook or manual).
async function processReview(brandId, { patientId, appointmentId, platform, rating, text }) {
  return agent.run(brandId, "process-review", async () => {
    // Analyze sentiment
    const sentiment = await agent.analyzeSentiment(text, rating);

    // Store review
    const review = await db.one(
      `insert into fmlh_reviews (brand_id, patient_id, appointment_id, platform, rating, review_text, sentiment, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [brandId, patientId, appointmentId || null, platform, rating, text,
       sentiment.sentiment, sentiment.needs_response ? "pending" : "responded"]
    );

    // Auto-draft response if needed
    if (sentiment.needs_response) {
      const response = await agent.draftResponse(
        { rating, text },
        sentiment.sentiment,
        config.clinicName || "Our Clinic"
      );
      await db.query(
        `update fmlh_reviews set response=$3, status='pending' where brand_id=$1 and id=$2`,
        [brandId, review.id, response.response]
      );
    }

    // Escalate negative reviews
    if (sentiment.sentiment === "negative" && sentiment.urgency === "high") {
      await bus.publish({
        brandId,
        from: "sentinel",
        to: "broadcast",
        topic: "review.negative",
        payload: {
          reviewId: review.id,
          rating,
          text: text.substring(0, 200),
          sentiment: sentiment.sentiment,
          concerns: sentiment.key_concerns,
        },
      });
    }

    // Log journey
    await db.one(
      `insert into fmlh_patient_journey (brand_id, patient_id, appointment_id, stage, action, channel, actor, meta)
       values ($1,$2,$3,'review_received','review_processed','platform','sentinel',$4) returning id`,
      [brandId, patientId, appointmentId, JSON.stringify({ platform, rating, sentiment: sentiment.sentiment })]
    );

    return { reviewId: review.id, sentiment: sentiment.sentiment, needsResponse: sentiment.needs_response };
  });
}

// Respond to a review.
async function respondToReview(brandId, reviewId, response) {
  const review = await db.one(
    `select * from fmlh_reviews where brand_id=$1 and id=$2`,
    [brandId, reviewId]
  );
  if (!review) throw new Error("review not found");

  await db.query(
    `update fmlh_reviews set response=$3, response_at=now(), status='responded' where brand_id=$1 and id=$2`,
    [brandId, reviewId, response]
  );

  // Post to platform
  await platforms.postResponse(brandId, reviewId, response, review.platform);

  return { reviewId, status: "responded" };
}

// Get all reviews.
async function listReviews(brandId, { sentiment, platform, limit = 50, offset = 0 } = {}) {
  let query = `select r.*, p.full_name as patient_name
               from fmlh_reviews r
               left join fmlh_patients p on p.id = r.patient_id
               where r.brand_id=$1`;
  const params = [brandId];
  let idx = 2;

  if (sentiment) {
    query += ` and r.sentiment = $${idx++}`;
    params.push(sentiment);
  }
  if (platform) {
    query += ` and r.platform = $${idx++}`;
    params.push(platform);
  }

  query += ` order by r.created_at desc limit $${idx++} offset $${idx++}`;
  params.push(Math.min(limit, 500), offset);

  return db.many(query, params);
}

// Get review stats.
async function getStats(brandId) {
  const stats = await db.one(
    `select
       count(*) as total,
       round(avg(rating)::numeric, 1) as avg_rating,
       count(*) filter (where sentiment='positive') as positive,
       count(*) filter (where sentiment='neutral') as neutral,
       count(*) filter (where sentiment='negative') as negative,
       count(*) filter (where status='pending') as pending_response
     from fmlh_reviews where brand_id=$1`,
    [brandId]
  );
  return {
    total: +stats.total,
    avg_rating: +stats.avg_rating || 0,
    positive: +stats.positive,
    neutral: +stats.neutral,
    negative: +stats.negative,
    pending_response: +stats.pending_response,
  };
}

// Auto-request reviews for completed appointments in last 24h.
async function autoRequestReviews(brandId) {
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const appointments = await db.many(
    `select a.id from fmlh_appointments a
     left join fmlh_reviews r on r.appointment_id = a.id
     where a.brand_id=$1 and a.status='completed'
     and a.scheduled_at >= $2 and r.id is null`,
    [brandId, since]
  );

  const results = [];
  for (const appt of appointments) {
    try {
      await requestReview(brandId, appt.id);
      results.push({ appointmentId: appt.id, status: "requested" });
    } catch (e) {
      results.push({ appointmentId: appt.id, status: "failed", error: e.message });
    }
  }
  return results;
}

module.exports = {
  requestReview, processReview, respondToReview,
  listReviews, getStats, autoRequestReviews,
};
