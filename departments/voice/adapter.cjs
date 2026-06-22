"use strict";
// Telephony + TTS/STT adapter. mock mode synthesizes a plausible transcript so
// the whole flow runs free. live mode calls a Python voice service
// (VOICE_ADAPTER_URL — Piper TTS + Whisper STT) bridged to a SIP/telephony API.
const axios = require("axios");
const config = require("../../core/config.cjs");
const log = require("../../core/logger.cjs").make("voice-adapter");

async function placeCall({ to, script }) {
  if (!config.isLive || !config.telephony.url) {
    // mock: pretend we dialed and got a short conversation.
    const transcript = [
      `AGENT: ${script.opener}`,
      `LEAD: Okay, go on. We're a bit busy though.`,
      `AGENT: ${script.objections?.too_busy || "Totally understand — 60 seconds?"}`,
      `LEAD: Sure, send me details and let's do a quick call this week.`,
      `AGENT: ${script.close}`,
    ].join("\n");
    return { status: "completed", duration_sec: 95, transcript, recording_url: null, provider: "mock" };
  }
  // TODO(live): POST to VOICE_ADAPTER_URL which (1) TTS the script via Piper,
  // (2) dials via TELEPHONY_API_URL, (3) STT the call via Whisper, returns transcript.
  const { data } = await axios.post(
    `${config.voiceAdapterUrl}/call`,
    { to, script, telephony: config.telephony },
    { timeout: 120000 }
  );
  return data;
}

module.exports = { placeCall };
