"use strict";
// FML Health — WhatsApp/SMS channel adapters. Mock | Live (Baileys).
const config = require("../../core/config.cjs");
const db = require("../../core/db.cjs");
const log = require("../../core/logger.cjs").make("fmlh:channels");

/**
 * Send a WhatsApp message to a patient.
 * Mock mode: logs + DB record. Live mode: Baileys HTTP API.
 */
async function whatsapp(brandId, patientId, { to, body, templateName, templateVars }) {
  const msg = await db.one(
    `insert into fmlh_messages (brand_id, patient_id, channel, direction, to_addr, body, status, provider)
     values ($1,$2,'whatsapp','out',$3,$4,'queued',$5) returning id`,
    [brandId, patientId, to, body, config.isLive ? "baileys" : "mock"]
  );

  if (!config.isLive) {
    log.info(`[MOCK] WhatsApp → ${to}: ${body.substring(0, 80)}...`);
    await db.query(
      `update fmlh_messages set status='sent', meta=$2 where id=$1`,
      [msg.id, JSON.stringify({ mock: true, sentAt: new Date().toISOString() })]
    );
    return { id: msg.id, status: "sent", mock: true };
  }

  // Live mode: POST to Baileys HTTP API
  try {
    const axios = require("axios");
    const resp = await axios.post(
      `${config.whatsapp.url}/send`,
      { to, body, templateName, templateVars },
      { headers: { Authorization: `Bearer ${config.whatsapp.token}` }, timeout: 15000 }
    );
    await db.query(
      `update fmlh_messages set status='sent', meta=$2 where id=$1`,
      [msg.id, JSON.stringify({ providerId: resp.data?.id, sentAt: new Date().toISOString() })]
    );
    return { id: msg.id, status: "sent", providerId: resp.data?.id };
  } catch (e) {
    await db.query(
      `update fmlh_messages set status='failed', meta=$2 where id=$1`,
      [msg.id, JSON.stringify({ error: e.message })]
    );
    log.error(`WhatsApp send failed: ${e.message}`);
    return { id: msg.id, status: "failed", error: e.message };
  }
}

/**
 * Send an SMS to a patient.
 */
async function sms(brandId, patientId, { to, body }) {
  const msg = await db.one(
    `insert into fmlh_messages (brand_id, patient_id, channel, direction, to_addr, body, status, provider)
     values ($1,$2,'sms','out',$3,$4,'queued',$5) returning id`,
    [brandId, patientId, to, body, config.isLive ? (config.smsProvider || "msg91") : "mock"]
  );

  if (!config.isLive) {
    log.info(`[MOCK] SMS → ${to}: ${body.substring(0, 80)}...`);
    await db.query(
      `update fmlh_messages set status='sent', meta=$2 where id=$1`,
      [msg.id, JSON.stringify({ mock: true, sentAt: new Date().toISOString() })]
    );
    return { id: msg.id, status: "sent", mock: true };
  }

  // Live mode: MSG91 / Twilio
  try {
    const axios = require("axios");
    if (config.smsProvider === "twilio") {
      const twilio = require("twilio")(config.smsApiKey, config.smsApiSecret);
      await twilio.messages.create({ body, from: config.smsSenderId, to });
    } else {
      // MSG91
      await axios.post("https://api.msg91.com/api/v5/otp", {
        mobile: to,
        otp: body,
        sender: config.smsSenderId,
      }, { headers: { authkey: config.smsApiKey } });
    }
    await db.query(
      `update fmlh_messages set status='sent', meta=$2 where id=$1`,
      [msg.id, JSON.stringify({ sentAt: new Date().toISOString() })]
    );
    return { id: msg.id, status: "sent" };
  } catch (e) {
    await db.query(
      `update fmlh_messages set status='failed', meta=$2 where id=$1`,
      [msg.id, JSON.stringify({ error: e.message })]
    );
    log.error(`SMS send failed: ${e.message}`);
    return { id: msg.id, status: "failed", error: e.message };
  }
}

/**
 * Send a chat message (for web widget / in-app chat).
 */
async function chat(brandId, patientId, { to, body, threadId }) {
  const msg = await db.one(
    `insert into fmlh_messages (brand_id, patient_id, channel, direction, to_addr, body, status, provider)
     values ($1,$2,'chat','out',$3,$4,'sent','internal') returning id`,
    [brandId, patientId, to || "web", body]
  );
  return { id: msg.id, status: "sent" };
}

/**
 * Determine best channel for a patient based on preferences and availability.
 */
function bestChannel(patient) {
  if (patient.preferred_channel) return patient.preferred_channel;
  if (patient.phone) return "whatsapp";
  if (patient.email) return "chat";
  return "sms";
}

module.exports = { whatsapp, sms, chat, bestChannel };
