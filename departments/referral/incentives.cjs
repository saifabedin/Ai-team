"use strict";
// Referral incentive management — rewards, tracking, redemption.
const db = require("../../core/db.cjs");
const log = require("../../core/logger.cjs").make("fmlh:incentives");

/**
 * Default incentive configuration.
 * Can be customized per brand via fmlh_referrals.meta.
 */
const DEFAULT_INCENTIVES = {
  referrer: {
    type: "discount",
    value: 100,  // ₹100 discount on next visit
    description: "₹100 discount on your next consultation",
    min_visits: 1,  // Must have at least 1 visit
  },
  referred: {
    type: "discount",
    value: 50,   // ₹50 off first visit
    description: "₹50 off your first consultation",
    valid_days: 30,  // Valid for 30 days
  },
};

/**
 * Generate a unique referral code for a patient.
 */
function generateCode(patientName, patientId) {
  const namePart = (patientName || "PAT").replace(/[^A-Z]/gi, "").substring(0, 3).toUpperCase();
  const idPart = patientId.toString(36).toUpperCase().slice(-4);
  const rand = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `FML${namePart}${idPart}${rand}`;
}

/**
 * Validate a referral code.
 */
async function validateCode(brandId, code) {
  const referrer = await db.oneOrNone(
    `select * from fmlh_patients where brand_id=$1 and referral_code=$2`,
    [brandId, code]
  );
  if (!referrer) return { valid: false, error: "Invalid referral code" };
  if (referrer.status !== "active") return { valid: false, error: "Referrer account inactive" };
  return { valid: true, referrerId: referrer.id, referrerName: referrer.full_name };
}

/**
 * Apply incentive to a patient's account.
 */
async function applyIncentive(brandId, patientId, incentiveType, incentiveValue, referralId) {
  // Store incentive in patient meta for now (could be a separate table)
  await db.query(
    `update fmlh_patients set meta = meta || $3 where brand_id=$1 and id=$2`,
    [brandId, patientId, JSON.stringify({
      incentive: {
        type: incentiveType,
        value: incentiveValue,
        referral_id: referralId,
        applied_at: new Date().toISOString(),
        redeemed: false,
      },
    })]
  );
  return { applied: true, type: incentiveType, value: incentiveValue };
}

/**
 * Check if patient has unredeemed incentive.
 */
async function checkIncentive(brandId, patientId) {
  const patient = await db.oneOrNone(
    `select meta from fmlh_patients where brand_id=$1 and id=$2`,
    [brandId, patientId]
  );
  if (!patient?.meta?.incentive) return null;
  const inc = patient.meta.incentive;
  if (inc.redeemed) return null;
  return inc;
}

/**
 * Mark incentive as redeemed.
 */
async function redeemIncentive(brandId, patientId) {
  await db.query(
    `update fmlh_patients set meta = jsonb_set(meta, '{incentive,redeemed}', 'true') where brand_id=$1 and id=$2`,
    [brandId, patientId]
  );
  return { redeemed: true };
}

/**
 * Get referral stats for a brand.
 */
async function getStats(brandId) {
  const stats = await db.one(
    `select
       count(*) as total,
       count(*) filter (where status='converted') as converted,
       count(*) filter (where status='pending') as pending,
       count(*) filter (where status='contacted') as contacted,
       count(*) filter (where status='expired') as expired,
       coalesce(sum(incentive_value) filter (where incentive_claimed=true), 0) as total_incentive_value
     from fmlh_referrals where brand_id=$1`,
    [brandId]
  );
  return {
    total: +stats.total,
    converted: +stats.converted,
    pending: +stats.pending,
    contacted: +stats.contacted,
    expired: +stats.expired,
    conversion_rate: stats.total > 0 ? (+stats.converted / +stats.total * 100).toFixed(1) + "%" : "0%",
    total_incentive_value: +stats.total_incentive_value,
  };
}

/**
 * Get top referrers for a brand.
 */
async function getTopReferrers(brandId, limit = 10) {
  return db.many(
    `select p.id, p.full_name, p.phone, p.referral_code,
            count(r.id) as referral_count,
            count(r.id) filter (where r.status='converted') as converted_count
     from fmlh_patients p
     join fmlh_referrals r on r.referrer_patient_id = p.id
     where p.brand_id=$1
     group by p.id, p.full_name, p.phone, p.referral_code
     order by converted_count desc, referral_count desc
     limit $2`,
    [brandId, limit]
  );
}

module.exports = {
  DEFAULT_INCENTIVES, generateCode, validateCode,
  applyIncentive, checkIncentive, redeemIncentive,
  getStats, getTopReferrers,
};
