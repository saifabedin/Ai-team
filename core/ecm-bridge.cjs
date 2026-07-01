"use strict";
// ECM AI OS Engine Bridge — reuses engines 1-8 directly without code duplication.
// Engines are required via absolute paths; their own dependencies resolve within ecm-ai-os.
const path = require("path");
const dotenv = require("dotenv");
const logger = require("./logger.cjs").make("ecm-bridge");

// Load ai-team .env so engines can read FB_PAGE_ACCESS_TOKEN, OPENROUTER_API_KEY, etc.
dotenv.config({ path: path.join(__dirname, "../.env") });

const ECM_ENGINES = "/home/ubuntu/ecm-ai-os/backend/engines";

// Lazy-load engines so failures are isolated per engine
const _engines = {};
function loadEngine(name, file) {
  if (_engines[name]) return _engines[name];
  try {
    _engines[name] = require(path.join(ECM_ENGINES, file));
    logger.info(`loaded engine: ${name}`);
  } catch (e) {
    logger.error(`failed to load engine ${name}: ${e.message}`);
    _engines[name] = null;
  }
  return _engines[name];
}

// --- Public API: each function wraps one engine with standardised input/output ---

async function runResearch(input) {
  const engine = loadEngine("research", "engine1-research.cjs");
  if (!engine) return fallback("research", "engine not loaded");
  try {
    return await engine({
      businessName: input.businessName || input.business || "FixMyLeads",
      niche: input.niche || "Digital Marketing",
      targetAudience: input.targetAudience || "Business owners, HR teams",
      location: input.location || "India",
      goal: input.goal || "Generate leads and sales",
      platform: input.platform || "Instagram",
      brandId: input.brandId,
    });
  } catch (e) {
    logger.error(`research failed: ${e.message}`);
    return fallback("research", e.message);
  }
}

async function runContent(input) {
  const engine = loadEngine("content", "engine2-content.cjs");
  if (!engine) return fallback("content", "engine not loaded");
  try {
    return await engine({
      research: input.research || {},
      businessName: input.businessName || "FixMyLeads",
      platform: input.platform || "Instagram",
      goal: input.goal || "Generate leads and sales",
    });
  } catch (e) {
    logger.error(`content failed: ${e.message}`);
    return fallback("content", e.message);
  }
}

async function runImage(input) {
  const engine = loadEngine("image", "engine3-image.cjs");
  if (!engine) return fallback("image", "engine not loaded");
  try {
    return await engine({
      content: input.content || {},
      data: input.data || {},
    });
  } catch (e) {
    logger.error(`image failed: ${e.message}`);
    return fallback("image", e.message);
  }
}

async function runPublish(input) {
  const engine = loadEngine("publish", "engine5-publish.cjs");
  if (!engine) return fallback("publish", "engine not loaded");
  try {
    return await engine({
      content: input.content || {},
      script: input.script,
      jobId: input.jobId,
      brandId: input.brandId,
      pageId: input.pageId,
    });
  } catch (e) {
    logger.error(`publish failed: ${e.message}`);
    return fallback("publish", e.message);
  }
}

async function runAds(input) {
  const engine = loadEngine("ads", "engine6-ads.cjs");
  if (!engine) return fallback("ads", "engine not loaded");
  try {
    return await engine({
      research: input.research || {},
      hooks: input.hooks || [],
      adCopies: input.adCopies || [],
      businessName: input.businessName || "FixMyLeads",
      platform: input.platform || "Facebook",
      goal: input.goal || "Generate leads",
      metrics: input.metrics || {},
    });
  } catch (e) {
    logger.error(`ads failed: ${e.message}`);
    return fallback("ads", e.message);
  }
}

async function runTracking(input) {
  const engine = loadEngine("tracking", "engine7-tracking.cjs");
  if (!engine) return fallback("tracking", "engine not loaded");
  try {
    return await engine({
      ads: input.ads || {},
      trackingData: input.trackingData || {},
    });
  } catch (e) {
    logger.error(`tracking failed: ${e.message}`);
    return fallback("tracking", e.message);
  }
}

async function runOptimization(input) {
  const engine = loadEngine("optimization", "engine8-optimization.cjs");
  if (!engine) return fallback("optimization", "engine not loaded");
  try {
    return await engine({
      tracking: input.tracking || {},
      ads: input.ads || {},
      businessName: input.businessName || "FixMyLeads",
      goal: input.goal || "Generate leads and sales",
      platform: input.platform || "Instagram",
    });
  } catch (e) {
    logger.error(`optimization failed: ${e.message}`);
    return fallback("optimization", e.message);
  }
}

function fallback(engine, reason) {
  return {
    success: false,
    engine,
    jobId: null,
    data: null,
    error: reason,
  };
}

// Full pipeline: research -> content -> image (for social posts)
async function generateSocialContent(input) {
  logger.info("running full social content pipeline");

  const research = await runResearch(input);
  if (!research.success) return research;

  const content = await runContent({ ...input, research: research.data });
  if (!content.success) return content;

  const images = await runImage({ content: content.data });
  // Images are optional — content is still useful without them

  return {
    success: true,
    engine: "social-pipeline",
    jobId: research.jobId,
    data: {
      research: research.data,
      content: content.data,
      images: images.data,
    },
    error: null,
  };
}

module.exports = {
  runResearch,
  runContent,
  runImage,
  runPublish,
  runAds,
  runTracking,
  runOptimization,
  generateSocialContent,
};
