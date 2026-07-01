"use strict";
// Inbound WhatsApp webhook handler — receives messages from Baileys/WPPConnect
// and routes them to the appropriate department (patient-coordinator for FML Health).
const express = require("express");
const config = require("../core/config.cjs");
const log = require("../core/logger.cjs").make("webhook:whatsapp");
const db = require("../core/db.cjs");

const router = express.Router();

// POST /webhook/whatsapp — receive inbound WhatsApp messages
// Expected body: { phone, message, from, timestamp?, mediaUrl? }
router.post("/", async (req, res) => {
  try {
    const { phone, message, from, timestamp, mediaUrl } = req.body || {};

    if (!phone || !message) {
      return res.status(400).json({ error: "bad_request", detail: "phone and message required" });
    }

    // Normalize phone (digits only)
    const normalizedPhone = String(phone).replace(/\D/g, "");

    // Log inbound message to DB
    await db.one(
      `insert into fmlh_messages (brand_id, patient_id, channel, direction, from_addr, body, status, provider, meta)
       values ($1, null, 'whatsapp', 'in', $2, $3, 'received', 'webhook', $4) returning id`,
      [
        config.defaultBrandId,
        normalizedPhone,
        message,
        JSON.stringify({ from, timestamp: timestamp || new Date().toISOString(), mediaUrl }),
      ]
    );

    log.info(`inbound WhatsApp from ${normalizedPhone}: ${message.substring(0, 80)}...`);

    // Find patient by phone
    const patient = await db.oneOrNone(
      `select id, full_name, language from fmlh_patients
       where brand_id=$1 and phone=$2`,
      [config.defaultBrandId, normalizedPhone]
    );

    // Auto-intake if new patient
    let patientId = patient?.id;
    if (!patientId) {
      const newPatient = await db.one(
        `insert into fmlh_patients (brand_id, full_name, phone, language, status)
         values ($1, $2, $3, 'en', 'active') returning id`,
        [config.defaultBrandId, `WhatsApp User ${normalizedPhone.slice(-4)}`, normalizedPhone]
      );
      patientId = newPatient.id;
      log.info(`auto-intaked new patient #${patientId} from ${normalizedPhone}`);
    }

    // Forward to patient-coordinator for intent classification and response
    // This is done asynchronously — we respond 200 immediately to WhatsApp
    const coordinator = require("../../departments/patient-coordinator/service.cjs");
    coordinator.handleMessage(config.defaultBrandId, patientId, message).catch(e => {
      log.error(`coordinator.handleMessage failed: ${e.message}`);
    });

    return res.json({ ok: true, patientId });
  } catch (e) {
    log.error(`webhook error: ${e.message}`);
    return res.status(500).json({ error: "internal", detail: e.message });
  }
});

// Health check for webhook
router.get("/health", (_req, res) => res.json({ ok: true, endpoint: "whatsapp-webhook" }));

module.exports = router;
