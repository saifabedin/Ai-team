"use strict";
// Outbound channel adapters. mock mode = logs + DB record (free, safe).
// live mode = real send via free/self-hosted providers.
const axios = require("axios");
const config = require("../../core/config.cjs");
const db = require("../../core/db.cjs");
const log = require("../../core/logger.cjs").make("channels");

// Lazy-load sheets-api to avoid circular deps
let sheetsApi = null;
function getSheetsApi() {
  if (!sheetsApi) {
    try { sheetsApi = require("../lead-intel/sheets-api.cjs"); } catch (e) { /* optional */ }
  }
  return sheetsApi;
}

const SHEET_URL = process.env.AUTOPILOT_SHEET_URL || "";

async function recordMessage(brandId, leadId, channel, payload, status, provider) {
  return db.one(
    `insert into ait_messages (brand_id, lead_id, channel, direction, to_addr, subject, body, status, provider, meta)
     values ($1,$2,$3,'out',$4,$5,$6,$7,$8,$9) returning id`,
    [brandId, leadId, channel, payload.to || null, payload.subject || null,
     payload.body || null, status, provider, payload.meta || {}]
  );
}

// Update Google Sheet Status column after successful outreach
async function updateSheetStatus(brandId, leadId, channel) {
  if (!SHEET_URL) return;
  const api = getSheetsApi();
  if (!api) return;
  try {
    const lead = await db.oneOrNone(
      `select email, phone from ait_leads where id=$1 and brand_id=$2`, [leadId, brandId]
    );
    if (!lead) return;
    // Count messages to determine status (Sent 1, Sent 2, Sent 3)
    const msgCount = await db.one(
      `select count(*)::int as cnt from ait_messages
       where lead_id=$1 and brand_id=$2 and direction='out' and status='sent'`,
      [leadId, brandId]
    );
    const status = `Sent ${msgCount.cnt}`;
    await api.updateStatus(SHEET_URL, { email: lead.email, phone: lead.phone, status });
  } catch (e) {
    log.warn("sheet status update failed", e.message);
  }
}

const channels = {
  // EMAIL — live via Gmail SMTP app password (free). mock otherwise.
  async email(brandId, leadId, { to, subject, body }) {
    if (!config.isLive || !config.gmail.user) {
      log.info(`[mock email] -> ${to} | ${subject}`);
      await recordMessage(brandId, leadId, "email", { to, subject, body }, "sent", "mock");
      return { ok: true, provider: "mock" };
    }
    // Live: Gmail SMTP via nodemailer
    const nodemailer = require("nodemailer");
    const tx = nodemailer.createTransport({
      service: "gmail",
      auth: { user: config.gmail.user, pass: config.gmail.appPassword },
    });
    await tx.sendMail({ from: config.gmail.user, to, subject, text: body });
    await recordMessage(brandId, leadId, "email", { to, subject, body }, "sent", "gmail");
    await updateSheetStatus(brandId, leadId, "email");
    return { ok: true, provider: "gmail" };
  },

  // WHATSAPP — live via a self-hosted/free WhatsApp HTTP API (e.g. wppconnect).
  async whatsapp(brandId, leadId, { to, body }) {
    if (!config.isLive || !config.whatsapp.url) {
      log.info(`[mock whatsapp] -> ${to}`);
      await recordMessage(brandId, leadId, "whatsapp", { to, body }, "sent", "mock");
      return { ok: true, provider: "mock" };
    }
    // WPPConnect Server expects { phone, message }, phone = digits only (cc + number).
    const phone = String(to || "").replace(/\D/g, "");
    await axios.post(
      config.whatsapp.url,
      { phone, message: body, isGroup: false },
      { headers: { Authorization: `Bearer ${config.whatsapp.token}` }, timeout: 20000 }
    );
    await recordMessage(brandId, leadId, "whatsapp", { to, body }, "sent", "wpp");
    await updateSheetStatus(brandId, leadId, "whatsapp");
    return { ok: true, provider: "wpp" };
  },

  // LINKEDIN — mock by default (ToS). live needs an authenticated automation.
  async linkedin(brandId, leadId, { to, body }) {
    if (config.isLive) {
      log.warn(`[linkedin] live automation not implemented — message not sent to ${to}`);
      await recordMessage(brandId, leadId, "linkedin", { to, body }, "failed", "not-implemented");
      return { ok: false, provider: "not-implemented", note: "LinkedIn live sending not yet supported" };
    }
    log.info(`[mock linkedin] -> ${to}`);
    await recordMessage(brandId, leadId, "linkedin", { to, body }, "sent", "mock");
    return { ok: true, provider: "mock" };
  },
};

module.exports = channels;
