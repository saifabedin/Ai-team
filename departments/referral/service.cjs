"use strict";
// Referral orchestration — generate codes, track referrals, manage incentives.
const db = require("../../core/db.cjs");
const bus = require("../../core/bus.cjs");
const { ReferralAgent } = require("./agent.cjs");
const incentives = require("./incentives.cjs");
const config = require("../../core/config.cjs");

const agent = new ReferralAgent();

// Generate a referral code for a patient.
async function generateCode(brandId, patientId) {
  return agent.run(brandId, "generate-code", async () => {
    const patient = await db.one(
      `select * from fmlh_patients where brand_id=$1 and id=$2`,
      [brandId, patientId]
    );
    if (!patient) throw new Error("patient not found");

    // Check if already has a code
    if (patient.referral_code) {
      return { referralCode: patient.referral_code, existing: true };
    }

    // Generate unique code
    const code = incentives.generateCode(patient.full_name, patient.id);

    // Update patient
    await db.query(
      `update fmlh_patients set referral_code=$3 where brand_id=$1 and id=$2`,
      [brandId, patientId, code]
    );

    return { referralCode: code, existing: false };
  });
}

// Create a referral (when someone uses a code).
async function createReferral(brandId, { referralCode, referredName, referredPhone }) {
  return agent.run(brandId, "create-referral", async () => {
    // Validate code
    const validation = await incentives.validateCode(brandId, referralCode);
    if (!validation.valid) throw new Error(validation.error);

    // Create referral record
    const referral = await db.one(
      `insert into fmlh_referrals (brand_id, referrer_patient_id, referral_code, referred_name, referred_phone, status, incentive_type, incentive_value)
       values ($1,$2,$3,$4,$5,'pending',$6,$7) returning *`,
      [brandId, validation.referrerId, referralCode, referredName, referredPhone,
       incentives.DEFAULT_INCENTIVES.referred.type,
       incentives.DEFAULT_INCENTIVES.referred.value]
    );

    // Log journey for referrer
    await db.one(
      `insert into fmlh_patient_journey (brand_id, patient_id, stage, action, actor, meta)
       values ($1,$2,'referral_given','referral_created','connector',$3) returning id`,
      [brandId, validation.referrerId, JSON.stringify({ referralId: referral.id, referredName })]
    );

    return { referralId: referral.id, referrerName: validation.referrerName };
  });
}

// Mark referral as converted (when referred patient completes first visit).
async function convertReferral(brandId, referralId, referredPatientId) {
  return agent.run(brandId, "convert-referral", async () => {
    const referral = await db.one(
      `select * from fmlh_referrals where brand_id=$1 and id=$2`,
      [brandId, referralId]
    );
    if (!referral) throw new Error("referral not found");
    if (referral.status === "converted") return { alreadyConverted: true };

    // Update referral status
    await db.query(
      `update fmlh_referrals set status='converted', referred_patient_id=$3, incentive_claimed=true where brand_id=$1 and id=$2`,
      [brandId, referralId, referredPatientId]
    );

    // Apply incentive to referrer
    await incentives.applyIncentive(
      brandId, referral.referrer_patient_id,
      referral.incentive_type, referral.incentive_value, referralId
    );

    // Apply incentive to referred patient
    await incentives.applyIncentive(
      brandId, referredPatientId,
      incentives.DEFAULT_INCENTIVES.referred.type,
      incentives.DEFAULT_INCENTIVES.referred.value, referralId
    );

    // Get referrer info for thank-you message
    const referrer = await db.one(
      `select * from fmlh_patients where brand_id=$1 and id=$2`,
      [brandId, referral.referrer_patient_id]
    );

    // Send thank-you messages
    const thankYou = await agent.thankYouMessage(
      { full_name: referrer.full_name, language: referrer.language },
      referral.referred_name,
      `${referral.incentive_type}: ${referral.incentive_value}`
    );

    const channels = require("../patient-coordinator/channels.cjs");

    // Thank referrer
    await channels.whatsapp(brandId, referral.referrer_patient_id, {
      to: referrer.phone,
      body: thankYou.referrer_message,
    });

    // Welcome referred patient
    if (referredPatientId) {
      const referred = await db.oneOrNone(
        `select * from fmlh_patients where brand_id=$1 and id=$2`,
        [brandId, referredPatientId]
      );
      if (referred) {
        await channels.whatsapp(brandId, referredPatientId, {
          to: referred.phone,
          body: thankYou.referred_message,
        });
      }
    }

    // Log journey
    await db.one(
      `insert into fmlh_patient_journey (brand_id, patient_id, stage, action, actor, meta)
       values ($1,$2,'referral_converted','referral_completed','connector',$3) returning id`,
      [brandId, referral.referrer_patient_id, JSON.stringify({ referralId, referredName: referral.referred_name })]
    );

    // Publish event
    await bus.publish({
      brandId,
      from: "connector",
      to: "broadcast",
      topic: "referral.converted",
      payload: { referralId, referrerId: referral.referrer_patient_id, referredPatientId },
    });

    return { referralId, status: "converted" };
  });
}

// Get referral link for sharing.
async function getShareLink(brandId, patientId) {
  const patient = await db.one(
    `select * from fmlh_patients where brand_id=$1 and id=$2`,
    [brandId, patientId]
  );
  if (!patient) throw new Error("patient not found");

  // Generate code if not exists
  let code = patient.referral_code;
  if (!code) {
    code = incentives.generateCode(patient.full_name, patient.id);
    await db.query(
      `update fmlh_patients set referral_code=$3 where brand_id=$1 and id=$2`,
      [brandId, patientId, code]
    );
  }

  // Generate message — use clinic's website from white_label config or fallback to booking link
  const clinicDomain = config.bookingLink || "https://clinic.example.com";
  const msg = await agent.referralMessage(
    { full_name: patient.full_name, language: patient.language },
    "Our Clinic",
    code,
    `${clinicDomain}/refer/${code}`
  );

  return {
    referralCode: code,
    shareLink: `${clinicDomain}/refer/${code}`,
    message: msg.message,
    whatsappShare: msg.whatsapp_share,
  };
}

// List referrals.
async function listReferrals(brandId, { status, limit = 50, offset = 0 } = {}) {
  let query = `select r.*, p.full_name as referrer_name
               from fmlh_referrals r
               join fmlh_patients p on p.id = r.referrer_patient_id
               where r.brand_id=$1`;
  const params = [brandId];
  let idx = 2;

  if (status) {
    query += ` and r.status = $${idx++}`;
    params.push(status);
  }

  query += ` order by r.created_at desc limit $${idx++} offset $${idx++}`;
  params.push(Math.min(limit, 500), offset);

  return db.many(query, params);
}

// Get referral stats.
async function getStats(brandId) {
  return incentives.getStats(brandId);
}

// Get top referrers.
async function getTopReferrers(brandId, limit = 10) {
  return incentives.getTopReferrers(brandId, limit);
}

module.exports = {
  generateCode, createReferral, convertReferral,
  getShareLink, listReferrals, getStats, getTopReferrers,
};
