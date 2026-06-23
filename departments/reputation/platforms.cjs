"use strict";
// Review platform adapters — Google, Practo, JustDial (mock + live).
const config = require("../../core/config.cjs");
const log = require("../../core/logger.cjs").make("fmlh:platforms");

/**
 * Generate a review link for the patient.
 */
function getReviewLink(platform, clinicId) {
  const links = {
    google: `https://search.google.com/local/writereview?placeid=${clinicId || "MOCK_PLACE_ID"}`,
    practo: `https://www.practo.com/clinic/${clinicId || "mock-clinic"}/reviews`,
    justdial: `https://www.justdial.com/${clinicId || "mock-clinic"}/reviews`,
  };
  return links[platform] || links.google;
}

/**
 * Send a review request to a patient via WhatsApp.
 */
async function sendReviewRequest(brandId, patient, appointment, platform = "google") {
  const reviewLink = getReviewLink(platform, config.googlePlacesId);

  if (!config.isLive) {
    log.info(`[MOCK] Review request sent to ${patient.full_name} for ${platform}`);
    return {
      status: "sent",
      mock: true,
      platform,
      link: reviewLink,
    };
  }

  // Live mode: send via WhatsApp with review link
  const channels = require("../patient-coordinator/channels.cjs");
  const lang = patient.language || "en";

  const messages = {
    en: `Hi ${patient.full_name}! How was your visit to our clinic? We'd love your feedback! Please share your experience: ${reviewLink}`,
    hi: `नमस्ते ${patient.full_name}! आपकी क्लिनिक विज़िट कैसी रही? हमें आपकी प्रतिक्रिया चाहिए! कृपया अनुभव साझा करें: ${reviewLink}`,
  };

  const msg = messages[lang] || messages.en;
  await channels.whatsapp(brandId, patient.id, { to: patient.phone, body: msg });

  return { status: "sent", platform, link: reviewLink };
}

/**
 * Post a response to a review (mock — logs only).
 */
async function postResponse(brandId, reviewId, response, platform) {
  if (!config.isLive) {
    log.info(`[MOCK] Response posted to review #${reviewId} on ${platform}`);
    return { status: "posted", mock: true };
  }

  // Live mode would integrate with Google Places API, etc.
  log.warn(`Live ${platform} response posting not yet implemented`);
  return { status: "pending", platform, note: "Live integration pending" };
}

/**
 * Fetch reviews from a platform (mock — returns empty).
 */
async function fetchReviews(brandId, platform = "google") {
  if (!config.isLive) {
    return { reviews: [], mock: true };
  }

  // Live mode would fetch from Google Places API, etc.
  log.warn(`Live ${platform} review fetching not yet implemented`);
  return { reviews: [], platform };
}

module.exports = { getReviewLink, sendReviewRequest, postResponse, fetchReviews };
