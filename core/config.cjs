"use strict";
require("dotenv").config();

const config = {
  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  llm: {
    provider: process.env.LLM_PROVIDER || "openai", // openai | anthropic
    baseUrl: process.env.LLM_BASE_URL || "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.LLM_API_KEY || "",
    model: process.env.LLM_MODEL || "meta/llama-3.3-70b-instruct",
    fastModel: process.env.LLM_MODEL_FAST || "meta/llama-3.1-8b-instruct",
  },
  port: parseInt(process.env.PORT || "4100", 10),
  dashboardPort: parseInt(process.env.DASHBOARD_PORT || "4101", 10),
  jwtSecret: process.env.JWT_SECRET || "",
  defaultBrandId: process.env.DEFAULT_BRAND_ID || "fixmyleads",
  providerMode: process.env.PROVIDER_MODE || "mock", // 'mock' | 'live'
  gmail: {
    user: process.env.GMAIL_USER || "",
    appPassword: process.env.GMAIL_APP_PASSWORD || "",
  },
  whatsapp: {
    url: process.env.WHATSAPP_API_URL || "",
    token: process.env.WHATSAPP_API_TOKEN || "",
  },
  linkedinCookie: process.env.LINKEDIN_COOKIE || "",
  voiceAdapterUrl: process.env.VOICE_ADAPTER_URL || "http://127.0.0.1:4108",
  telephony: {
    url: process.env.TELEPHONY_API_URL || "",
    token: process.env.TELEPHONY_API_TOKEN || "",
  },
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    allowedUserIds: (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
  notionToken: process.env.NOTION_TOKEN || "",
  googleSheetsWebhook: process.env.GOOGLE_SHEETS_WEBHOOK || "",
  bookingLink: process.env.BOOKING_LINK || "",   // Cal.com or any booking URL
  // FML Health config
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID || "",
  googleCalendarApiKey: process.env.GOOGLE_CALENDAR_API_KEY || "",
  googlePlacesId: process.env.GOOGLE_PLACES_ID || "",
  smsProvider: process.env.SMS_PROVIDER || "msg91",
  smsApiKey: process.env.SMS_API_KEY || "",
  smsApiSecret: process.env.SMS_API_SECRET || "",
  smsSenderId: process.env.SMS_SENDER_ID || "FMLHLT",
  corsOrigins: process.env.CORS_ORIGINS || "*",
  timezone: process.env.TIMEZONE || "Asia/Kolkata",
  clinicName: process.env.CLINIC_NAME || "",
};

config.isLive = config.providerMode === "live";

// JWT secret required in all modes — prevents accidental insecure deployments.
if (!config.jwtSecret) {
  if (config.isLive) {
    throw new Error("JWT_SECRET must be set in live mode.");
  }
  // eslint-disable-next-line no-console
  console.warn("[security] WARNING: JWT_SECRET is not set. Using insecure dev fallback.");
  // Dev-only fallback so auth doesn't crash — NEVER use in production
  config.jwtSecret = "dev-only-not-for-production";
  config._insecureJwt = true; // Flag for middleware to add warning header
}

module.exports = config;
